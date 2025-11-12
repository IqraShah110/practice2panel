"""
Authentication module with signup, login, verification, password reset, and Google OAuth.
"""
from flask import Blueprint, request, jsonify, session
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import random
import re
import os
from functools import wraps
from db_handler import get_pg_connection
from email_service import (
    send_verification_code,
    send_password_reset_code,
    send_welcome_email,
    send_password_change_notification
)

auth_bp = Blueprint('auth', __name__)

# Email validation regex
EMAIL_REGEX = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')

def login_required(f):
    """Decorator for routes that require login (returns HTML response)"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'success': False, 'message': 'Please login to access this resource'}), 401
        return f(*args, **kwargs)
    return decorated_function

def api_login_required(f):
    """Decorator for API routes that require login (returns JSON response)"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'success': False, 'message': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated_function

def generate_verification_code():
    """Generate a 6-digit verification code"""
    return str(random.randint(100000, 999999))

def validate_email(email):
    """Validate email format"""
    if not email or not EMAIL_REGEX.match(email):
        return False
    return True

def validate_password(password):
    """Validate password (minimum 6 characters)"""
    if not password or len(password) < 6:
        return False
    return True

# ==================== SIGNUP ====================
@auth_bp.route('/api/auth/signup', methods=['POST'])
def signup():
    """User signup endpoint"""
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        full_name = data.get('full_name', '').strip()
        
        # Validation
        if not email:
            return jsonify({'success': False, 'message': 'Email is required'}), 400
        if not validate_email(email):
            return jsonify({'success': False, 'message': 'Invalid email format'}), 400
        if not password:
            return jsonify({'success': False, 'message': 'Password is required'}), 400
        if not validate_password(password):
            return jsonify({'success': False, 'message': 'Password must be at least 6 characters'}), 400
        if not full_name:
            return jsonify({'success': False, 'message': 'Full name is required'}), 400
        
        conn = get_pg_connection()
        try:
            with conn.cursor() as cursor:
                # Check if email already exists
                cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
                if cursor.fetchone():
                    return jsonify({'success': False, 'message': 'Email already registered'}), 400
                
                # Generate password hash with salt (SHA-256 via werkzeug)
                password_hash = generate_password_hash(password, method='pbkdf2:sha256')
                
                # Generate verification code
                verification_code = generate_verification_code()
                verification_expires = datetime.now() + timedelta(minutes=15)
                
                # Insert user
                cursor.execute("""
                    INSERT INTO users (email, password_hash, full_name, 
                                     verification_code, verification_expires)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id
                """, (email, password_hash, full_name, 
                      verification_code, verification_expires))
                
                user_id = cursor.fetchone()[0]
                conn.commit()
                
                # Send verification email
                email_sent, email_error = send_verification_code(email, verification_code, full_name)
                if not email_sent:
                    # User created but email failed - log but don't fail signup
                    print(f"Warning: Failed to send verification email: {email_error}")
                
                return jsonify({
                    'success': True,
                    'message': 'Account created successfully. Please check your email for verification code.',
                    'user_id': user_id
                }), 201
        
        except Exception as e:
            conn.rollback()
            return jsonify({'success': False, 'message': f'Database error: {str(e)}'}), 500
        finally:
            conn.close()
    
    except Exception as e:
        return jsonify({'success': False, 'message': f'Server error: {str(e)}'}), 500

# ==================== VERIFY EMAIL ====================
@auth_bp.route('/api/auth/verify-email', methods=['POST'])
def verify_email():
    """Verify email with verification code"""
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        code = data.get('code', '').strip()
        
        if not email or not code:
            return jsonify({'success': False, 'message': 'Email and verification code are required'}), 400
        
        conn = get_pg_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT id, full_name, verification_code, verification_expires, is_verified
                    FROM users WHERE email = %s
                """, (email,))
                
                user = cursor.fetchone()
                if not user:
                    return jsonify({'success': False, 'message': 'User not found'}), 404
                
                user_id, full_name, stored_code, expires, is_verified = user
                
                if is_verified:
                    return jsonify({'success': False, 'message': 'Email already verified'}), 400
                
                if not stored_code or stored_code != code:
                    return jsonify({'success': False, 'message': 'Invalid verification code'}), 400
                
                if expires < datetime.now():
                    return jsonify({'success': False, 'message': 'Verification code expired'}), 400
                
                # Verify user
                cursor.execute("""
                    UPDATE users 
                    SET is_verified = TRUE, verification_code = NULL, verification_expires = NULL
                    WHERE id = %s
                """, (user_id,))
                
                conn.commit()
                
                # Send welcome email
                send_welcome_email(email, full_name)
                
                return jsonify({
                    'success': True,
                    'message': 'Email verified successfully'
                }), 200
        
        except Exception as e:
            conn.rollback()
            return jsonify({'success': False, 'message': f'Database error: {str(e)}'}), 500
        finally:
            conn.close()
    
    except Exception as e:
        return jsonify({'success': False, 'message': f'Server error: {str(e)}'}), 500

# ==================== RESEND VERIFICATION CODE ====================
@auth_bp.route('/api/auth/resend-verification', methods=['POST'])
def resend_verification():
    """Resend verification code with 60-second cooldown"""
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        
        if not email:
            return jsonify({'success': False, 'message': 'Email is required'}), 400
        
        conn = get_pg_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT id, full_name, verification_code, verification_expires, is_verified
                    FROM users WHERE email = %s
                """, (email,))
                
                user = cursor.fetchone()
                if not user:
                    return jsonify({'success': False, 'message': 'User not found'}), 404
                
                user_id, full_name, stored_code, expires, is_verified = user
                
                if is_verified:
                    return jsonify({'success': False, 'message': 'Email already verified'}), 400
                
                # Check cooldown (60 seconds)
                if stored_code and expires:
                    time_since_creation = (expires - datetime.now()).total_seconds()
                    if time_since_creation > (15 * 60 - 60):  # Less than 60 seconds passed
                        return jsonify({
                            'success': False,
                            'message': 'Please wait 60 seconds before requesting a new code'
                        }), 429
                
                # Generate new code
                verification_code = generate_verification_code()
                verification_expires = datetime.now() + timedelta(minutes=15)
                
                cursor.execute("""
                    UPDATE users 
                    SET verification_code = %s, verification_expires = %s
                    WHERE id = %s
                """, (verification_code, verification_expires, user_id))
                
                conn.commit()
                
                # Send verification email
                email_sent, email_error = send_verification_code(email, verification_code, full_name)
                if not email_sent:
                    return jsonify({'success': False, 'message': f'Failed to send email: {email_error}'}), 500
                
                return jsonify({
                    'success': True,
                    'message': 'Verification code sent successfully'
                }), 200
        
        except Exception as e:
            conn.rollback()
            return jsonify({'success': False, 'message': f'Database error: {str(e)}'}), 500
        finally:
            conn.close()
    
    except Exception as e:
        return jsonify({'success': False, 'message': f'Server error: {str(e)}'}), 500

# ==================== LOGIN ====================
@auth_bp.route('/api/auth/login', methods=['POST'])
def login():
    """User login endpoint"""
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        remember_me = data.get('remember_me', False)
        
        if not email or not password:
            return jsonify({'success': False, 'message': 'Email and password are required'}), 400
        
        conn = get_pg_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT id, email, password_hash, full_name, is_verified, is_active
                    FROM users WHERE email = %s
                """, (email,))
                
                user = cursor.fetchone()
                if not user:
                    return jsonify({'success': False, 'message': 'Invalid email or password'}), 401
                
                user_id, db_email, password_hash, full_name, is_verified, is_active = user
                
                # Check account status
                if not is_active:
                    return jsonify({'success': False, 'message': 'Account is deactivated'}), 403
                
                # Check email verification
                if not is_verified:
                    return jsonify({
                        'success': False,
                        'message': 'Please verify your email before logging in'
                    }), 403
                
                # Verify password
                if not password_hash or not check_password_hash(password_hash, password):
                    return jsonify({'success': False, 'message': 'Invalid email or password'}), 401
                
                # Update last login
                cursor.execute("""
                    UPDATE users SET last_login = %s WHERE id = %s
                """, (datetime.now(), user_id))
                conn.commit()
                
                # Create session
                session['user_id'] = user_id
                session['email'] = db_email
                session['full_name'] = full_name
                
                # Set session expiry (30 days for remember me, else browser session)
                if remember_me:
                    session.permanent = True
                    # Flask session default expiry is 31 days
                else:
                    session.permanent = False
                
                return jsonify({
                    'success': True,
                    'message': 'Login successful',
                    'user': {
                        'id': user_id,
                        'email': db_email,
                        'full_name': full_name
                    }
                }), 200
        
        except Exception as e:
            conn.rollback()
            return jsonify({'success': False, 'message': f'Database error: {str(e)}'}), 500
        finally:
            conn.close()
    
    except Exception as e:
        return jsonify({'success': False, 'message': f'Server error: {str(e)}'}), 500

# ==================== LOGOUT ====================
@auth_bp.route('/api/auth/logout', methods=['POST'])
def logout():
    """User logout endpoint"""
    try:
        session.clear()
        return jsonify({
            'success': True,
            'message': 'Logged out successfully'
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'message': f'Server error: {str(e)}'}), 500

# ==================== FORGOT PASSWORD ====================
@auth_bp.route('/api/auth/forgot-password', methods=['POST'])
def forgot_password():
    """Request password reset code"""
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        
        if not email:
            return jsonify({'success': False, 'message': 'Email is required'}), 400
        
        conn = get_pg_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT id, full_name, is_verified FROM users WHERE email = %s
                """, (email,))
                
                user = cursor.fetchone()
                if not user:
                    # Don't reveal if email exists (security)
                    return jsonify({
                        'success': True,
                        'message': 'If the email exists, a reset code has been sent'
                    }), 200
                
                user_id, full_name, is_verified = user
                
                if not is_verified:
                    return jsonify({
                        'success': False,
                        'message': 'Please verify your email first'
                    }), 403
                
                # Generate reset code
                reset_token = generate_verification_code()
                reset_expires = datetime.now() + timedelta(minutes=15)
                
                cursor.execute("""
                    UPDATE users 
                    SET reset_token = %s, reset_expires = %s
                    WHERE id = %s
                """, (reset_token, reset_expires, user_id))
                
                conn.commit()
                
                # Send reset code email
                email_sent, email_error = send_password_reset_code(email, reset_token, full_name)
                if not email_sent:
                    return jsonify({'success': False, 'message': f'Failed to send email: {email_error}'}), 500
                
                return jsonify({
                    'success': True,
                    'message': 'If the email exists, a reset code has been sent'
                }), 200
        
        except Exception as e:
            conn.rollback()
            return jsonify({'success': False, 'message': f'Database error: {str(e)}'}), 500
        finally:
            conn.close()
    
    except Exception as e:
        return jsonify({'success': False, 'message': f'Server error: {str(e)}'}), 500

# ==================== VERIFY RESET CODE ====================
@auth_bp.route('/api/auth/verify-reset-code', methods=['POST'])
def verify_reset_code():
    """Verify password reset code"""
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        code = data.get('code', '').strip()
        
        if not email or not code:
            return jsonify({'success': False, 'message': 'Email and reset code are required'}), 400
        
        conn = get_pg_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT id, reset_token, reset_expires FROM users WHERE email = %s
                """, (email,))
                
                user = cursor.fetchone()
                if not user:
                    return jsonify({'success': False, 'message': 'Invalid reset code'}), 400
                
                user_id, reset_token, reset_expires = user
                
                if not reset_token or reset_token != code:
                    return jsonify({'success': False, 'message': 'Invalid reset code'}), 400
                
                if not reset_expires or reset_expires < datetime.now():
                    return jsonify({'success': False, 'message': 'Reset code expired'}), 400
                
                # Code is valid - don't clear it yet, wait for password reset
                return jsonify({
                    'success': True,
                    'message': 'Reset code verified'
                }), 200
        
        except Exception as e:
            return jsonify({'success': False, 'message': f'Database error: {str(e)}'}), 500
        finally:
            conn.close()
    
    except Exception as e:
        return jsonify({'success': False, 'message': f'Server error: {str(e)}'}), 500

# ==================== RESET PASSWORD ====================
@auth_bp.route('/api/auth/reset-password', methods=['POST'])
def reset_password():
    """Reset password with reset code"""
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        code = data.get('code', '').strip()
        new_password = data.get('new_password', '')
        
        if not email or not code or not new_password:
            return jsonify({'success': False, 'message': 'Email, reset code, and new password are required'}), 400
        
        if not validate_password(new_password):
            return jsonify({'success': False, 'message': 'Password must be at least 6 characters'}), 400
        
        conn = get_pg_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT id, reset_token, reset_expires, full_name FROM users WHERE email = %s
                """, (email,))
                
                user = cursor.fetchone()
                if not user:
                    return jsonify({'success': False, 'message': 'Invalid reset code'}), 400
                
                user_id, reset_token, reset_expires, full_name = user
                
                if not reset_token or reset_token != code:
                    return jsonify({'success': False, 'message': 'Invalid reset code'}), 400
                
                if not reset_expires or reset_expires < datetime.now():
                    return jsonify({'success': False, 'message': 'Reset code expired'}), 400
                
                # Update password
                password_hash = generate_password_hash(new_password, method='pbkdf2:sha256')
                cursor.execute("""
                    UPDATE users 
                    SET password_hash = %s, reset_token = NULL, reset_expires = NULL
                    WHERE id = %s
                """, (password_hash, user_id))
                
                conn.commit()
                
                # Send notification email
                send_password_change_notification(email, full_name)
                
                return jsonify({
                    'success': True,
                    'message': 'Password reset successfully'
                }), 200
        
        except Exception as e:
            conn.rollback()
            return jsonify({'success': False, 'message': f'Database error: {str(e)}'}), 500
        finally:
            conn.close()
    
    except Exception as e:
        return jsonify({'success': False, 'message': f'Server error: {str(e)}'}), 500

# ==================== CHANGE PASSWORD ====================
@auth_bp.route('/api/auth/change-password', methods=['POST'])
@api_login_required
def change_password():
    """Change password for logged-in users"""
    try:
        data = request.get_json()
        current_password = data.get('current_password', '')
        new_password = data.get('new_password', '')
        
        if not current_password or not new_password:
            return jsonify({'success': False, 'message': 'Current password and new password are required'}), 400
        
        if not validate_password(new_password):
            return jsonify({'success': False, 'message': 'Password must be at least 6 characters'}), 400
        
        user_id = session.get('user_id')
        
        conn = get_pg_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT password_hash, email, full_name FROM users WHERE id = %s
                """, (user_id,))
                
                user = cursor.fetchone()
                if not user:
                    return jsonify({'success': False, 'message': 'User not found'}), 404
                
                password_hash, email, full_name = user
                
                # Verify current password
                if not password_hash or not check_password_hash(password_hash, current_password):
                    return jsonify({'success': False, 'message': 'Current password is incorrect'}), 401
                
                # Update password
                new_password_hash = generate_password_hash(new_password, method='pbkdf2:sha256')
                cursor.execute("""
                    UPDATE users SET password_hash = %s WHERE id = %s
                """, (new_password_hash, user_id))
                
                conn.commit()
                
                # Send notification email
                send_password_change_notification(email, full_name)
                
                return jsonify({
                    'success': True,
                    'message': 'Password changed successfully'
                }), 200
        
        except Exception as e:
            conn.rollback()
            return jsonify({'success': False, 'message': f'Database error: {str(e)}'}), 500
        finally:
            conn.close()
    
    except Exception as e:
        return jsonify({'success': False, 'message': f'Server error: {str(e)}'}), 500

# ==================== GET USER PROFILE ====================
@auth_bp.route('/api/auth/profile', methods=['GET'])
@api_login_required
def get_profile():
    """Get user profile"""
    try:
        user_id = session.get('user_id')
        
        conn = get_pg_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT id, email, full_name, is_verified, 
                           created_at, last_login, is_active
                    FROM users WHERE id = %s
                """, (user_id,))
                
                user = cursor.fetchone()
                if not user:
                    return jsonify({'success': False, 'message': 'User not found'}), 404
                
                return jsonify({
                    'success': True,
                    'user': {
                        'id': user[0],
                        'email': user[1],
                        'full_name': user[2],
                        'is_verified': user[3],
                        'created_at': user[4].isoformat() if user[4] else None,
                        'last_login': user[5].isoformat() if user[5] else None,
                        'is_active': user[6]
                    }
                }), 200
        
        except Exception as e:
            return jsonify({'success': False, 'message': f'Database error: {str(e)}'}), 500
        finally:
            conn.close()
    
    except Exception as e:
        return jsonify({'success': False, 'message': f'Server error: {str(e)}'}), 500

# ==================== UPDATE USER PROFILE ====================
@auth_bp.route('/api/auth/profile', methods=['PUT'])
@api_login_required
def update_profile():
    """Update user profile"""
    try:
        data = request.get_json()
        full_name = data.get('full_name', '').strip()
        
        if not full_name:
            return jsonify({'success': False, 'message': 'Full name is required'}), 400
        
        user_id = session.get('user_id')
        
        conn = get_pg_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute("""
                    UPDATE users 
                    SET full_name = %s
                    WHERE id = %s
                    RETURNING id, email, full_name
                """, (full_name, user_id))
                
                user = cursor.fetchone()
                if not user:
                    return jsonify({'success': False, 'message': 'User not found'}), 404
                
                conn.commit()
                
                # Update session
                session['full_name'] = user[2]
                
                return jsonify({
                    'success': True,
                    'message': 'Profile updated successfully',
                    'user': {
                        'id': user[0],
                        'email': user[1],
                        'full_name': user[2]
                    }
                }), 200
        
        except Exception as e:
            conn.rollback()
            return jsonify({'success': False, 'message': f'Database error: {str(e)}'}), 500
        finally:
            conn.close()
    
    except Exception as e:
        return jsonify({'success': False, 'message': f'Server error: {str(e)}'}), 500

# ==================== GOOGLE OAUTH ====================
@auth_bp.route('/api/auth/google/authorize', methods=['GET'])
def google_authorize():
    """Get Google OAuth authorization URL"""
    try:
        from google_auth_oauthlib.flow import Flow
        from google.oauth2 import id_token
        from google.auth.transport import requests as google_requests
        
        # Google OAuth configuration
        GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID')
        GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET')
        FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000')
        allowed_frontend_origins = {
            FRONTEND_URL.rstrip('/'),
            'http://localhost:3000',
            'http://127.0.0.1:3000'
        }

        request_origin = request.headers.get('Origin')
        if request_origin and request_origin.rstrip('/') in allowed_frontend_origins:
            frontend_origin = request_origin.rstrip('/')
        else:
            frontend_origin = FRONTEND_URL.rstrip('/')

        redirect_uri = f"{frontend_origin}/auth/google/callback"
        configured_redirect_uris = {f"{origin}/auth/google/callback" for origin in allowed_frontend_origins}
        configured_redirect_uris.add(redirect_uri)
        
        if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
            return jsonify({
                'success': False,
                'message': 'Google OAuth not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env'
            }), 500
        
        # Allow HTTP in local development (required by oauthlib)
        if redirect_uri.startswith('http://'):
            os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

        # Create OAuth flow
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": list(configured_redirect_uris)
                }
            },
            scopes=['openid', 'https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile']
        )
        
        # Explicitly set redirect_uri to avoid "Missing required parameter: redirect_uri"
        flow.redirect_uri = redirect_uri
        
        # Log redirect URI for debugging
        print(f"[Google OAuth] Using redirect URI: {redirect_uri}")
        print(f"[Google OAuth] Frontend URL: {frontend_origin}")

        authorization_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent'
        )
        
        # Store state in session
        session['oauth_state'] = state
        session['oauth_redirect_uri'] = redirect_uri
        
        return jsonify({
            'success': True,
            'authorization_url': authorization_url
        }), 200
        
    except ImportError as e:
        return jsonify({
            'success': False,
            'message': 'Google OAuth libraries not installed. Please run: pip install google-auth google-auth-oauthlib google-auth-httplib2'
        }), 500
    except Exception as e:
        import traceback
        error_msg = str(e)
        print(f"Google OAuth authorize error: {error_msg}")
        print(traceback.format_exc())
        return jsonify({'success': False, 'message': f'Google OAuth error: {error_msg}'}), 500

@auth_bp.route('/api/auth/google/callback', methods=['POST'])
def google_callback():
    """Handle Google OAuth callback"""
    try:
        from google_auth_oauthlib.flow import Flow
        from google.oauth2 import id_token
        from google.auth.transport import requests as google_requests
        
        data = request.get_json()
        authorization_code = data.get('code')
        state = data.get('state')
        
        if not authorization_code:
            return jsonify({'success': False, 'message': 'Authorization code missing'}), 400
        
        # Verify state
        if 'oauth_state' not in session or session['oauth_state'] != state:
            return jsonify({'success': False, 'message': 'Invalid state parameter'}), 400
        
        # Google OAuth configuration
        GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID')
        GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET')
        FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000')
        allowed_frontend_origins = {
            FRONTEND_URL.rstrip('/'),
            'http://localhost:3000',
            'http://127.0.0.1:3000'
        }

        stored_redirect_uri = session.get('oauth_redirect_uri')
        request_origin = request.headers.get('Origin')

        if stored_redirect_uri:
            redirect_uri = stored_redirect_uri
        elif request_origin and request_origin.rstrip('/') in allowed_frontend_origins:
            redirect_uri = f"{request_origin.rstrip('/')}/auth/google/callback"
        else:
            redirect_uri = f"{FRONTEND_URL.rstrip('/')}/auth/google/callback"

        configured_redirect_uris = {f"{origin}/auth/google/callback" for origin in allowed_frontend_origins}
        configured_redirect_uris.add(redirect_uri)
        
        if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
            return jsonify({
                'success': False,
                'message': 'Google OAuth not configured'
            }), 500
        
        # Allow HTTP in local development (required by oauthlib)
        if redirect_uri.startswith('http://'):
            os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

        # Create OAuth flow
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": list(configured_redirect_uris)
                }
            },
            scopes=['openid', 'https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile'],
            state=state
        )
        
        # Set redirect_uri BEFORE fetching token (must match exactly)
        flow.redirect_uri = redirect_uri
        
        # Exchange authorization code for tokens
        # Construct the authorization response URL that Google would normally send
        authorization_response = f"{redirect_uri}?code={authorization_code}&state={state}"
        
        try:
            flow.fetch_token(authorization_response=authorization_response)
            
            # Clear state from session after successful token exchange
            # This prevents code reuse if the request is made multiple times
            session.pop('oauth_state', None)
            session.pop('oauth_redirect_uri', None)
        except Exception as token_error:
            # More detailed error message for debugging
            error_msg = str(token_error)
            print(f"Token exchange error: {error_msg}")
            print(f"Redirect URI: {redirect_uri}")
            print(f"Client ID: {GOOGLE_CLIENT_ID[:20]}...")
            print(f"Authorization code: {authorization_code[:10]}...")
            
            # Check if it's an invalid_grant error (code expired or reused)
            if 'invalid_grant' in error_msg.lower():
                return jsonify({
                    'success': False,
                    'message': 'Authorization code expired or already used. Please try "Continue with Google" again.',
                    'error': 'The authorization code can only be used once and expires quickly. Close all tabs and try again.'
                }), 400
            
            return jsonify({
                'success': False,
                'message': f'Failed to exchange authorization code. Make sure redirect URI in Google Console matches exactly: {redirect_uri}',
                'error': error_msg
            }), 400
        
        # Get user info
        credentials = flow.credentials
        id_info = id_token.verify_oauth2_token(
            credentials.id_token,
            google_requests.Request(),
            GOOGLE_CLIENT_ID
        )
        
        google_id = id_info.get('sub')
        email = id_info.get('email', '').lower()
        full_name = id_info.get('name', '')
        picture = id_info.get('picture', '')
        
        if not email:
            return jsonify({'success': False, 'message': 'Email not provided by Google'}), 400
        
        conn = get_pg_connection()
        try:
            with conn.cursor() as cursor:
                # Check if user exists by Google ID
                cursor.execute("""
                    SELECT id, email, full_name, is_verified, is_active
                    FROM users WHERE google_id = %s
                """, (google_id,))
                
                user = cursor.fetchone()
                
                if user:
                    # Existing Google user
                    user_id, db_email, db_full_name, is_verified, is_active = user
                    
                    if not is_active:
                        return jsonify({'success': False, 'message': 'Account is deactivated'}), 403
                    
                    # Update last login
                    cursor.execute("""
                        UPDATE users SET last_login = %s WHERE id = %s
                    """, (datetime.now(), user_id))
                    conn.commit()
                    
                    # Create session
                    session['user_id'] = user_id
                    session['email'] = db_email
                    session['full_name'] = db_full_name
                    
                    return jsonify({
                        'success': True,
                        'message': 'Login successful',
                        'user': {
                            'id': user_id,
                            'email': db_email,
                            'full_name': db_full_name
                        }
                    }), 200
                else:
                    # Check if email exists (regular user)
                    cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
                    existing_user = cursor.fetchone()
                    
                    if existing_user:
                        # Email exists but no Google ID - link accounts
                        user_id = existing_user[0]
                        cursor.execute("""
                            UPDATE users 
                            SET google_id = %s, is_verified = TRUE, last_login = %s
                            WHERE id = %s
                        """, (google_id, datetime.now(), user_id))
                        conn.commit()
                        
                        cursor.execute("SELECT email, full_name FROM users WHERE id = %s", (user_id,))
                        user_data = cursor.fetchone()
                        
                        session['user_id'] = user_id
                        session['email'] = user_data[0]
                        session['full_name'] = user_data[1]
                        
                        return jsonify({
                            'success': True,
                            'message': 'Google account linked successfully',
                            'user': {
                                'id': user_id,
                                'email': user_data[0],
                                'full_name': user_data[1]
                            }
                        }), 200
                    else:
                        # New user - create account
                        cursor.execute("""
                            INSERT INTO users (email, full_name, google_id, is_verified, last_login)
                            VALUES (%s, %s, %s, TRUE, %s)
                            RETURNING id
                        """, (email, full_name, google_id, datetime.now()))
                        
                        user_id = cursor.fetchone()[0]
                        conn.commit()
                        
                        # Send welcome email
                        send_welcome_email(email, full_name)
                        
                        # Create session
                        session['user_id'] = user_id
                        session['email'] = email
                        session['full_name'] = full_name
                        
                        return jsonify({
                            'success': True,
                            'message': 'Account created successfully with Google',
                            'user': {
                                'id': user_id,
                                'email': email,
                                'full_name': full_name
                            }
                        }), 201
        
        except Exception as e:
            conn.rollback()
            return jsonify({'success': False, 'message': f'Database error: {str(e)}'}), 500
        finally:
            conn.close()
    
    except ImportError as e:
        return jsonify({
            'success': False,
            'message': 'Google OAuth libraries not installed. Please run: pip install google-auth google-auth-oauthlib google-auth-httplib2'
        }), 500
    except Exception as e:
        import traceback
        error_msg = str(e)
        print(f"Google OAuth callback error: {error_msg}")
        print(traceback.format_exc())
        return jsonify({'success': False, 'message': f'Google OAuth error: {error_msg}'}), 500

# ==================== CHECK AUTH STATUS ====================
@auth_bp.route('/api/auth/check', methods=['GET'])
def check_auth():
    """Check if user is authenticated"""
    try:
        if 'user_id' in session:
            return jsonify({
                'success': True,
                'authenticated': True,
                'user': {
                    'id': session.get('user_id'),
                    'email': session.get('email'),
                    'full_name': session.get('full_name')
                }
            }), 200
        else:
            return jsonify({
                'success': True,
                'authenticated': False
            }), 200
    except Exception as e:
        return jsonify({'success': False, 'message': f'Server error: {str(e)}'}), 500


"""
PayFine Encryption Module
Handles encryption/decryption of sensitive data (payment configs, etc.)

PRODUCTION NOTE: Replace with proper encryption using AWS KMS, Azure Key Vault, or similar
"""

import json
import base64
from cryptography.fernet import Fernet
import os


# In production, load this from environment variable or key management service
ENCRYPTION_KEY = os.getenv('ENCRYPTION_KEY', Fernet.generate_key())

# Initialize Fernet cipher
cipher = Fernet(ENCRYPTION_KEY)


def encrypt_payment_config(config_dict):
    """
    Encrypt payment gateway configuration
    
    Args:
        config_dict: Dictionary with payment config
    
    Returns:
        str: Encrypted config as base64 string
    """
    try:
        # Convert dict to JSON string
        json_str = json.dumps(config_dict)
        
        # Encrypt
        encrypted = cipher.encrypt(json_str.encode())
        
        # Return as base64 string
        return base64.b64encode(encrypted).decode()
        
    except Exception as e:
        # In production, log this error
        print(f"Encryption error: {e}")
        # Fallback: return unencrypted (NOT RECOMMENDED FOR PRODUCTION)
        return json.dumps(config_dict)


def decrypt_payment_config(encrypted_str):
    """
    Decrypt payment gateway configuration
    
    Args:
        encrypted_str: Encrypted config as base64 string
    
    Returns:
        dict: Decrypted config dictionary
    """
    try:
        # Decode from base64
        encrypted = base64.b64decode(encrypted_str.encode())
        
        # Decrypt
        decrypted = cipher.decrypt(encrypted)
        
        # Parse JSON
        return json.loads(decrypted.decode())
        
    except Exception as e:
        # In production, log this error
        print(f"Decryption error: {e}")
        # Fallback: try to parse as unencrypted JSON
        try:
            return json.loads(encrypted_str)
        except:
            return {}


def generate_encryption_key():
    """
    Generate a new encryption key
    
    Returns:
        str: Base64-encoded encryption key
    
    USAGE:
        Run this once to generate a key, then store in environment variable:
        export ENCRYPTION_KEY="<generated_key>"
    """
    key = Fernet.generate_key()
    return key.decode()


if __name__ == '__main__':
    # Generate and print a new encryption key
    print("Generated Encryption Key (store in ENCRYPTION_KEY env var):")
    print(generate_encryption_key())

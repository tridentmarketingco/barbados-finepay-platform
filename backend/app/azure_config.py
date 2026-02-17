"""
Azure Configuration Module
Handles Azure-specific service initialization for production/staging environments

This module is imported conditionally when ENVIRONMENT is set to 'production' or 'staging'.
It provides integration points for Azure services like:
- Azure Application Insights (monitoring)
- Azure Key Vault (secrets management)
- Azure Storage (file storage)
- Azure Service Bus (messaging)

Note: Azure SDK packages are optional dependencies. Install them only when deploying to Azure:
    pip install applicationinsights
    pip install azure-identity azure-keyvault-secrets
    pip install azure-storage-blob
    pip install azure-servicebus
"""

import os
import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    # Type hints only - these imports won't run at runtime
    from applicationinsights.flask.ext import AppInsights  # type: ignore
    from azure.identity import DefaultAzureCredential  # type: ignore
    from azure.keyvault.secrets import SecretClient  # type: ignore
    from azure.storage.blob import BlobServiceClient  # type: ignore
    from azure.servicebus import ServiceBusClient  # type: ignore

logger = logging.getLogger(__name__)


def init_azure_services(app):
    """
    Initialize Azure services for the Flask application.
    
    This function is called during app initialization when running in
    production or staging environments on Azure.
    
    Args:
        app: Flask application instance
        
    Services that can be configured:
    - Application Insights for monitoring and telemetry
    - Azure Key Vault for secure secrets management
    - Azure Blob Storage for file uploads
    - Azure Service Bus for async messaging
    """
    
    # Check if we're actually running on Azure
    azure_enabled = os.getenv('AZURE_ENABLED', 'false').lower() == 'true'
    
    if not azure_enabled:
        logger.info("Azure services disabled (AZURE_ENABLED not set to 'true')")
        return
    
    logger.info("Initializing Azure services...")
    
    # =============================================================================
    # APPLICATION INSIGHTS (Monitoring & Telemetry)
    # =============================================================================
    
    instrumentation_key = os.getenv('APPINSIGHTS_INSTRUMENTATION_KEY')
    if instrumentation_key:
        try:
            from applicationinsights.flask.ext import AppInsights  # type: ignore
            app_insights = AppInsights(app)
            app.config['APPINSIGHTS_INSTRUMENTATIONKEY'] = instrumentation_key
            logger.info("Application Insights initialized")
        except ImportError:
            logger.warning("applicationinsights package not installed, skipping Application Insights")
    else:
        logger.info("Application Insights not configured (no instrumentation key)")
    
    # =============================================================================
    # AZURE KEY VAULT (Secrets Management)
    # =============================================================================
    
    key_vault_url = os.getenv('AZURE_KEY_VAULT_URL')
    if key_vault_url:
        try:
            from azure.identity import DefaultAzureCredential  # type: ignore
            from azure.keyvault.secrets import SecretClient  # type: ignore
            
            credential = DefaultAzureCredential()
            secret_client = SecretClient(vault_url=key_vault_url, credential=credential)
            
            # Store client in app config for later use
            app.config['AZURE_KEY_VAULT_CLIENT'] = secret_client
            logger.info(f"Azure Key Vault initialized: {key_vault_url}")
            
            # Example: Load secrets from Key Vault
            # secret_name = "database-password"
            # secret = secret_client.get_secret(secret_name)
            # app.config['DATABASE_PASSWORD'] = secret.value
            
        except ImportError:
            logger.warning("azure-identity or azure-keyvault-secrets not installed")
        except Exception as e:
            logger.error(f"Failed to initialize Azure Key Vault: {e}")
    else:
        logger.info("Azure Key Vault not configured")
    
    # =============================================================================
    # AZURE BLOB STORAGE (File Storage)
    # =============================================================================
    
    storage_connection_string = os.getenv('AZURE_STORAGE_CONNECTION_STRING')
    if storage_connection_string:
        try:
            from azure.storage.blob import BlobServiceClient  # type: ignore
            
            blob_service_client = BlobServiceClient.from_connection_string(storage_connection_string)
            app.config['AZURE_BLOB_CLIENT'] = blob_service_client
            logger.info("Azure Blob Storage initialized")
            
        except ImportError:
            logger.warning("azure-storage-blob package not installed")
        except Exception as e:
            logger.error(f"Failed to initialize Azure Blob Storage: {e}")
    else:
        logger.info("Azure Blob Storage not configured")
    
    # =============================================================================
    # AZURE SERVICE BUS (Messaging)
    # =============================================================================
    
    service_bus_connection_string = os.getenv('AZURE_SERVICE_BUS_CONNECTION_STRING')
    if service_bus_connection_string:
        try:
            from azure.servicebus import ServiceBusClient  # type: ignore
            
            service_bus_client = ServiceBusClient.from_connection_string(service_bus_connection_string)
            app.config['AZURE_SERVICE_BUS_CLIENT'] = service_bus_client
            logger.info("Azure Service Bus initialized")
            
        except ImportError:
            logger.warning("azure-servicebus package not installed")
        except Exception as e:
            logger.error(f"Failed to initialize Azure Service Bus: {e}")
    else:
        logger.info("Azure Service Bus not configured")
    
    logger.info("Azure services initialization complete")


def get_secret_from_keyvault(app, secret_name):
    """
    Retrieve a secret from Azure Key Vault.
    
    Args:
        app: Flask application instance
        secret_name: Name of the secret to retrieve
        
    Returns:
        str: Secret value or None if not found
    """
    key_vault_client = app.config.get('AZURE_KEY_VAULT_CLIENT')
    
    if not key_vault_client:
        logger.warning("Azure Key Vault not initialized")
        return None
    
    try:
        secret = key_vault_client.get_secret(secret_name)
        return secret.value
    except Exception as e:
        logger.error(f"Failed to retrieve secret '{secret_name}': {e}")
        return None


def upload_to_blob_storage(app, container_name, blob_name, data):
    """
    Upload data to Azure Blob Storage.
    
    Args:
        app: Flask application instance
        container_name: Name of the blob container
        blob_name: Name of the blob
        data: Data to upload (bytes or file-like object)
        
    Returns:
        bool: True if successful, False otherwise
    """
    blob_client = app.config.get('AZURE_BLOB_CLIENT')
    
    if not blob_client:
        logger.warning("Azure Blob Storage not initialized")
        return False
    
    try:
        container_client = blob_client.get_container_client(container_name)
        
        # Create container if it doesn't exist
        if not container_client.exists():
            container_client.create_container()
        
        # Upload blob
        blob_client = container_client.get_blob_client(blob_name)
        blob_client.upload_blob(data, overwrite=True)
        
        logger.info(f"Uploaded blob: {container_name}/{blob_name}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to upload blob: {e}")
        return False

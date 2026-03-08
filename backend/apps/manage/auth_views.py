"""
Auth views
"""
import json
import logging
import traceback
from django.utils.decorators import method_decorator
from schema import Schema, And, Optional
from apps.loon_base_view import BaseView
from service.format_response import api_response
from service.permission.user_permission import user_permission_check
from service.manage.auth_service import auth_service_ins
from service.exception.custom_common_exception import CustomCommonException

logger = logging.getLogger("django")


class AuthConfigView(BaseView):
    """Auth configuration list"""

    post_schema = Schema({
        'type': And(str, lambda n: n in ['wecom', 'microsoft_oidc'], error='Auth type must be wecom or microsoft_oidc'),
        'client_id': And(str, lambda n: n != '', error='Client ID cannot be empty'),
        'client_secret': And(str, lambda n: n != '', error='Client Secret cannot be empty'),
        'redirect_uri': And(str, lambda n: n != '', error='Redirect URI cannot be empty'),
        Optional('is_enabled'): bool,
        Optional('description'): str,
        Optional('extra_config'): dict,
        Optional('agent_id'): str,
        Optional('azure_tenant_id'): str,
    })
    
    @user_permission_check('admin')
    def get(self, request, *args, **kwargs):
        """
        Get Auth configuration list
        """
        tenant_id = request.META.get('HTTP_TENANTID')
        search_value = request.GET.get('search_value', '')
        page = int(request.GET.get('page', 1))
        per_page = int(request.GET.get('per_page', 10))
        
        try:
            result = auth_service_ins.get_auth_config_list(
                tenant_id, search_value, page, per_page
            )
            return api_response(0, "", result)
        except CustomCommonException as e:
            return api_response(-1, str(e), {})
        except Exception as e:
            logger.error(traceback.format_exc())
            return api_response(-1, "Internal Server Error", {})
    
    @user_permission_check('admin')
    def post(self, request, *args, **kwargs):
        """
        Add Auth configuration
        """
        tenant_id = request.META.get('HTTP_TENANTID')
        creator_id = request.META.get('HTTP_USERID')
        json_str = request.body.decode('utf-8')
        request_data = json.loads(json_str)
        
        try:
            auth_type = request_data.get('type')
            extra = request_data.get('extra_config') or {}
            agent_id = request_data.get('agent_id') or extra.get('agent_id') or extra.get('agentId') or ''
            azure_tenant_id = request_data.get('azure_tenant_id') or extra.get('tenant_id') or extra.get('tenantId') or ''
            config_id = auth_service_ins.add_auth_config(
                tenant_id=tenant_id,
                creator_id=creator_id,
                auth_type=auth_type,
                client_id=request_data.get('client_id'),
                client_secret=request_data.get('client_secret'),
                redirect_uri=request_data.get('redirect_uri'),
                is_enabled=request_data.get('is_enabled', True),
                description=request_data.get('description', ''),
                agent_id=agent_id,
                azure_tenant_id=azure_tenant_id,
            )
            return api_response(0, "", {"config_id": config_id})
        except CustomCommonException as e:
            return api_response(-1, str(e), {})
        except Exception as e:
            logger.error(traceback.format_exc())
            return api_response(-1, "Internal Server Error", {})


class AuthConfigDetailView(BaseView):
    """Auth configuration details"""
    
    patch_schema = Schema({
        Optional('name'): str,
        Optional('client_id'): str,
        Optional('client_secret'): str,
        Optional('redirect_uri'): str,
        Optional('is_enabled'): bool,
        Optional('description'): str,
        Optional('agent_id'): str,
        Optional('azure_tenant_id'): str,
    })
    
    @user_permission_check('admin')
    def get(self, request, *args, **kwargs):
        """
        Get Auth configuration details
        """
        tenant_id = request.META.get('HTTP_TENANTID')
        config_id = kwargs.get('config_id')
        
        try:
            result = auth_service_ins.get_auth_config_detail(tenant_id, config_id)
            return api_response(0, "", {"auth_config": result})
        except CustomCommonException as e:
            return api_response(-1, str(e), {})
        except Exception as e:
            logger.error(traceback.format_exc())
            return api_response(-1, "Internal Server Error", {})
    
    @user_permission_check('admin')
    def patch(self, request, *args, **kwargs):
        """
        Update Auth configuration
        """
        tenant_id = request.META.get('HTTP_TENANTID')
        config_id = kwargs.get('config_id')
        json_str = request.body.decode('utf-8')
        request_data = json.loads(json_str)
        
        try:
            auth_service_ins.update_auth_config(
                tenant_id=tenant_id,
                config_id=config_id,
                name=request_data.get('name'),
                client_id=request_data.get('client_id'),
                client_secret=request_data.get('client_secret'),
                redirect_uri=request_data.get('redirect_uri'),
                is_enabled=request_data.get('is_enabled'),
                description=request_data.get('description'),
                agent_id=request_data.get('agent_id'),
                azure_tenant_id=request_data.get('azure_tenant_id'),
            )
            return api_response(0, "", {})
        except CustomCommonException as e:
            return api_response(-1, str(e), {})
        except Exception as e:
            logger.error(traceback.format_exc())
            return api_response(-1, "Internal Server Error", {})
    
    @user_permission_check('admin')
    def delete(self, request, *args, **kwargs):
        """
        Delete Auth configuration
        """
        tenant_id = request.META.get('HTTP_TENANTID')
        operator_id = request.META.get('HTTP_USERID')
        config_id = kwargs.get('config_id')
        
        try:
            auth_service_ins.delete_auth_config(tenant_id, config_id, operator_id)
            return api_response(0, "", {})
        except CustomCommonException as e:
            return api_response(-1, str(e), {})
        except Exception as e:
            logger.error(traceback.format_exc())
            return api_response(-1, "Internal Server Error", {})


class AuthLoginView(BaseView):
    """Auth login endpoint (no authentication required)"""
    
    def get(self, request, *args, **kwargs):
        """
        Get available Auth login methods
        """
        # For non-logged-in users, get tenant_id from domain
        tenant_id = request.META.get('HTTP_TENANTID', '00000000-0000-0000-0000-000000000001')
        
        try:
            auth_types = auth_service_ins.get_enabled_auth_types(tenant_id)
            return api_response(0, "", {"auth_types": auth_types})
        except Exception as e:
            logger.error(traceback.format_exc())
            return api_response(-1, "Internal Server Error", {})


class AuthWecomAuthView(BaseView):
    """Wecom Auth authorization (no authentication required)"""
    
    def get(self, request, *args, **kwargs):
        """
        Get Wecom authorization config for QR login
        """
        # For non-logged-in users, get tenant_id from domain
        tenant_id = request.META.get('HTTP_TENANTID', '00000000-0000-0000-0000-000000000001')
        
        try:
            flag, result = auth_service_ins.get_wecom_auth_url(tenant_id)
            if flag:
                return api_response(0, "", result)
            else:
                return api_response(-1, result.get('msg', 'Failed to get auth config'), {})
        except Exception as e:
            logger.error(traceback.format_exc())
            return api_response(-1, "Internal Server Error", {})


class AuthWecomCallbackView(BaseView):
    """Wecom Auth callback (no authentication required)"""
    
    def get(self, request, *args, **kwargs):
        """
        Handle Wecom Auth callback
        """
        # For non-logged-in users, get tenant_id from domain
        tenant_id = request.META.get('HTTP_TENANTID', '00000000-0000-0000-0000-000000000001')
        code = request.GET.get('code')
        
        if not code:
            return api_response(-1, "Authorization code missing", {})
        
        try:
            flag, result = auth_service_ins.wecom_callback(tenant_id, code)
            if flag:
                return api_response(0, "", result)
            else:
                return api_response(-1, result.get('msg', 'Login failed'), {})
        except Exception as e:
            logger.error(traceback.format_exc())
            return api_response(-1, "Internal Server Error", {})

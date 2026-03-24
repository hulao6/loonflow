"""
Auth service for Wecom and Microsoft OIDC login.
Uses BaseAuth (base info) + WecomAuthConfig / MicrosoftOidcAuthConfig (extension tables).
"""
import logging
import requests
from urllib.parse import quote_plus
from typing import Tuple, Dict, Optional, Any
from apps.manage.models import (
    BaseAuth,
    WecomAuthConfig,
    MicrosoftOidcAuthConfig,
)
from apps.account.models import User
from service.account.account_user_service import account_user_service_ins
from service.exception.custom_common_exception import CustomCommonException
from service.util.archive_service import archive_service_ins
from service.util.encrypt_service import encrypt_service_ins

logger = logging.getLogger("django")

AUTH_TYPE_DISPLAY = {
    "wecom": "企业微信",
    "microsoft_oidc": "Microsoft OIDC",
}


def _safe_decrypt(value: str) -> str:
    """解密 client_secret；若已是明文或解密失败则原样返回，兼容历史数据。"""
    if not value:
        return value
    try:
        return encrypt_service_ins.decrypt(value)
    except Exception:
        return value


def _get_base_and_ext(tenant_id: str, config_id: str) -> Tuple[Optional[BaseAuth], Optional[Any]]:
    """
    Resolve by config_id (BaseAuth.id). Returns (base, ext) or (None, None).
    ext is WecomAuthConfig or MicrosoftOidcAuthConfig.
    """
    base = (
        BaseAuth.objects.filter(id=config_id, tenant_id=tenant_id)
        .prefetch_related("wecom_config", "microsoft_oidc_config")
        .first()
    )
    if not base:
        return None, None
    if base.type == "wecom":
        ext = base.wecom_config.first()
        return (base, ext) if ext else (base, None)
    if base.type == "microsoft_oidc":
        ext = base.microsoft_oidc_config.first()
        return (base, ext) if ext else (base, None)
    return base, None


class AuthService:
    """Auth authentication service"""

    def get_auth_config_by_type(self, tenant_id: str, auth_type: str):
        """
        Get enabled Auth config by type. Returns extension instance (WecomAuthConfig or MicrosoftOidcAuthConfig).
        """
        try:
            base = (
                BaseAuth.objects.filter(tenant_id=tenant_id, type=auth_type, is_enabled=True)
                .prefetch_related("wecom_config", "microsoft_oidc_config")
                .first()
            )
            if not base:
                return None
            if auth_type == "wecom":
                return base.wecom_config.first()
            if auth_type == "microsoft_oidc":
                return base.microsoft_oidc_config.first()
            return None
        except Exception as e:
            logger.error(f"Failed to get Auth config: {str(e)}")
            return None

    def get_enabled_auth_types(self, tenant_id: str) -> list:
        try:
            return list(
                BaseAuth.objects.filter(tenant_id=tenant_id, is_enabled=True).values("type")
            )
        except Exception as e:
            logger.error(f"Failed to get enabled Auth types: {str(e)}")
            return []

    def get_wecom_auth_url(self, tenant_id: str) -> Tuple[bool, Dict]:
        config = self.get_auth_config_by_type(tenant_id, "wecom")
        if not config or not isinstance(config, WecomAuthConfig):
            return False, {"msg": "Wecom Auth config not found or disabled"}
        if not config.agent_id:
            return False, {"msg": "Wecom config missing agent_id"}
        return True, {
            "appid": config.client_id,
            "agentid": config.agent_id,
            "redirect_uri": config.redirect_uri,
            "auth_url": (
                f"https://open.weixin.qq.com/connect/oauth2/authorize?"
                f"appid={config.client_id}"
                f"&redirect_uri={quote_plus(config.redirect_uri)}"
                f"&response_type=code"
                f"&scope=snsapi_privateinfo"
                f"&agentid={config.agent_id}"
                f"&state=STATE#wechat_redirect"
            ),
        }

    def get_microsoft_oidc_auth_url(self, tenant_id: str) -> Tuple[bool, Dict]:
        """
        获取 Microsoft OIDC 授权地址配置，前端拿到后直接跳转到该 URL 进行登录。
        """
        config = self.get_auth_config_by_type(tenant_id, "microsoft_oidc")
        if not config or not isinstance(config, MicrosoftOidcAuthConfig):
            return False, {"msg": "Microsoft OIDC config not found or disabled"}

        if not config.azure_tenant_id:
            return False, {"msg": "Microsoft OIDC config missing azure_tenant_id"}

        # 按照 Microsoft identity platform v2.0 的标准授权地址拼装
        authorize_url = (
            f"https://login.microsoftonline.com/{config.azure_tenant_id}/oauth2/v2.0/authorize"
            f"?client_id={config.client_id}"
            f"&response_type=code"
            f"&redirect_uri={quote_plus(config.redirect_uri)}"
            f"&response_mode=query"
            f"&scope={quote_plus('openid profile email offline_access https://graph.microsoft.com/user.read')}"
            f"&state=ms_oidc_login"
        )

        return True, {
            "client_id": config.client_id,
            "redirect_uri": config.redirect_uri,
            "azure_tenant_id": config.azure_tenant_id,
            "auth_url": authorize_url,
        }

    def wecom_callback(self, tenant_id: str, code: str) -> Tuple[bool, Dict]:
        config = self.get_auth_config_by_type(tenant_id, "wecom")
        if not config or not isinstance(config, WecomAuthConfig):
            return False, {"msg": "Wecom OAuth config not found or disabled"}
        try:
            secret = _safe_decrypt(config.client_secret)
            token_url = (
                f"https://qyapi.weixin.qq.com/cgi-bin/gettoken?"
                f"corpid={config.client_id}&corpsecret={secret}"
            )
            token_response = requests.get(token_url, timeout=10)
            token_data = token_response.json()
            if token_data.get("errcode") != 0:
                logger.error(f"Failed to get Wecom access_token: {token_data}")
                return False, {"msg": f"Failed to get access_token: {token_data.get('errmsg')}"}
            access_token = token_data["access_token"]
            userinfo_url = (
                f"https://qyapi.weixin.qq.com/cgi-bin/user/getuserinfo?"
                f"access_token={access_token}&code={code}"
            )
            userinfo_response = requests.get(userinfo_url, timeout=10)
            userinfo_data = userinfo_response.json()
            if userinfo_data.get("errcode") != 0:
                logger.error(f"Failed to get Wecom user info: {userinfo_data}")
                return False, {"msg": f"Failed to get user info: {userinfo_data.get('errmsg')}"}
            userid = userinfo_data.get("UserId")
            if not userid:
                return False, {"msg": "User ID not found"}
            user = User.objects.filter(external_user_id=userid, tenant_id=tenant_id).first()
            if not user:
                return False, {"msg": "No system user found for this Wecom user, please contact the administrator"}
            flag, jwt_token = account_user_service_ins.get_user_jwt(user.email)
            if not flag:
                return False, {"msg": "Failed to generate JWT"}
            return True, {
                "jwt": jwt_token,
                "user_info": {
                    "id": str(user.id),
                    "name": user.name,
                    "email": user.email,
                    "avatar": user.avatar,
                },
            }
        except requests.RequestException as e:
            logger.error(f"Wecom OAuth request failed: {str(e)}")
            return False, {"msg": f"OAuth request failed: {str(e)}"}
        except Exception as e:
            logger.error(f"Wecom OAuth callback failed: {str(e)}")
            return False, {"msg": f"OAuth callback failed: {str(e)}"}

    def microsoft_oidc_callback(self, tenant_id: str, code: str) -> Tuple[bool, Dict]:
        """
        Microsoft OIDC 回调处理：
        1. 用 code 换取 access_token
        2. 使用 access_token 调 Microsoft Graph 获取用户信息
        3. 根据邮箱在本系统中匹配用户并签发 JWT
        """
        config = self.get_auth_config_by_type(tenant_id, "microsoft_oidc")
        if not config or not isinstance(config, MicrosoftOidcAuthConfig):
            return False, {"msg": "Microsoft OIDC config not found or disabled"}

        try:
            secret = _safe_decrypt(config.client_secret)
            token_url = f"https://login.microsoftonline.com/{config.azure_tenant_id}/oauth2/v2.0/token"
            # 按 OAuth2.0 标准使用 application/x-www-form-urlencoded 方式换 token
            data = {
                "client_id": config.client_id,
                "client_secret": secret,
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": config.redirect_uri,
                "scope": "openid profile email offline_access https://graph.microsoft.com/user.read",
            }
            token_response = requests.post(token_url, data=data, timeout=10)
            token_data = token_response.json()

            if "error" in token_data:
                logger.error(f"Failed to get Microsoft OIDC token: {token_data}")
                return False, {
                    "msg": f"Failed to get token: {token_data.get('error_description') or token_data.get('error')}"
                }

            access_token = token_data.get("access_token")
            if not access_token:
                return False, {"msg": "No access_token in Microsoft OIDC token response"}

            # 调 Graph API 获取用户信息
            me_url = "https://graph.microsoft.com/v1.0/me"
            headers = {"Authorization": f"Bearer {access_token}"}
            me_response = requests.get(me_url, headers=headers, timeout=10)
            me_data = me_response.json()

            if me_response.status_code >= 400 or "error" in me_data:
                logger.error(f"Failed to get Microsoft Graph user info: {me_data}")
                return False, {
                    "msg": "Failed to get user info from Microsoft Graph",
                }

            # 从返回中尽可能拿到邮箱
            email = (
                me_data.get("mail")
                or me_data.get("userPrincipalName")
                or me_data.get("preferred_username")
            )
            display_name = me_data.get("displayName") or ""

            if not email:
                return False, {"msg": "Microsoft account does not provide email, cannot login"}

            # 用邮箱 + tenant 匹配系统用户
            user = User.objects.filter(email__iexact=email, tenant_id=tenant_id).first()
            if not user:
                return False, {
                    "msg": "No system user bound to this Microsoft account email, please contact administrator"
                }

            flag, jwt_token = account_user_service_ins.get_user_jwt(user.email)
            if not flag:
                return False, {"msg": "Failed to generate JWT"}

            return True, {
                "jwt": jwt_token,
                "user_info": {
                    "id": str(user.id),
                    "name": user.name or display_name or email,
                    "email": user.email,
                    "avatar": user.avatar,
                },
            }
        except requests.RequestException as e:
            logger.error(f"Microsoft OIDC request failed: {str(e)}")
            return False, {"msg": f"OAuth request failed: {str(e)}"}
        except Exception as e:
            logger.error(f"Microsoft OIDC callback failed: {str(e)}")
            return False, {"msg": f"OAuth callback failed: {str(e)}"}

    def add_auth_config(
        self,
        tenant_id: str,
        creator_id: str,
        auth_type: str,
        client_id: str,
        client_secret: str,
        redirect_uri: str,
        is_enabled: bool = True,
        description: str = "",
        *,
        agent_id: str = "",
        azure_tenant_id: str = "",
    ) -> str:
        if auth_type == "wecom":
            if not agent_id:
                raise CustomCommonException("Wecom config requires agent_id")
            existing = BaseAuth.objects.filter(tenant_id=tenant_id, type="wecom", is_enabled=True).first()
            if existing and is_enabled:
                raise CustomCommonException("An enabled Wecom auth config already exists")
            base = BaseAuth(
                tenant_id=tenant_id,
                creator_id=creator_id,
                type="wecom",
                is_enabled=is_enabled,
                description=description,
            )
            base.save()
            WecomAuthConfig.objects.create(
                base_auth=base,
                client_id=client_id,
                client_secret=encrypt_service_ins.encrypt(client_secret),
                redirect_uri=redirect_uri,
                agent_id=agent_id,
            )
            return str(base.id)

        if auth_type == "microsoft_oidc":
            if not azure_tenant_id:
                raise CustomCommonException("Microsoft OIDC config requires azure_tenant_id (tenant_id)")
            existing = BaseAuth.objects.filter(
                tenant_id=tenant_id, type="microsoft_oidc", is_enabled=True
            ).first()
            if existing and is_enabled:
                raise CustomCommonException("An enabled Microsoft OIDC auth config already exists")
            base = BaseAuth(
                tenant_id=tenant_id,
                creator_id=creator_id,
                type="microsoft_oidc",
                is_enabled=is_enabled,
                description=description,
            )
            base.save()
            MicrosoftOidcAuthConfig.objects.create(
                base_auth=base,
                client_id=client_id,
                client_secret=encrypt_service_ins.encrypt(client_secret),
                redirect_uri=redirect_uri,
                azure_tenant_id=azure_tenant_id,
            )
            return str(base.id)

        raise CustomCommonException(f"Unsupported auth type: {auth_type}")

    def update_auth_config(
        self,
        tenant_id: str,
        config_id: str,
        client_id: str = None,
        client_secret: str = None,
        redirect_uri: str = None,
        is_enabled: bool = None,
        description: str = None,
        *,
        agent_id: str = None,
        azure_tenant_id: str = None,
    ) -> bool:
        base, ext = _get_base_and_ext(tenant_id, config_id)
        if not base or not ext:
            raise CustomCommonException("Auth config not found")
        if is_enabled is not None:
            if is_enabled:
                BaseAuth.objects.filter(tenant_id=tenant_id, type=base.type).exclude(id=config_id).update(
                    is_enabled=False
                )
            base.is_enabled = is_enabled
        if description is not None:
            base.description = description
        base.save()
        if client_id is not None:
            ext.client_id = client_id
        if client_secret is not None:
            ext.client_secret = encrypt_service_ins.encrypt(client_secret)
        if redirect_uri is not None:
            ext.redirect_uri = redirect_uri
        if isinstance(ext, WecomAuthConfig) and agent_id is not None:
            ext.agent_id = agent_id
        if isinstance(ext, MicrosoftOidcAuthConfig) and azure_tenant_id is not None:
            ext.azure_tenant_id = azure_tenant_id
        ext.save()
        return True

    def delete_auth_config(self, tenant_id: str, config_id: str, operator_id: str) -> bool:
        base, ext = _get_base_and_ext(tenant_id, config_id)
        if not base:
            raise CustomCommonException("Auth config not found")
        archive_service_ins.archive_record("BaseAuth", base, operator_id)
        return True

    def get_auth_config_list(
        self, tenant_id: str, search_value: str = "", page: int = 1, per_page: int = 10
    ):
        try:
            qs = BaseAuth.objects.filter(tenant_id=tenant_id)
            if search_value:
                qs = qs.filter(name__icontains=search_value)
            qs = qs.order_by("-created_at")
            total = qs.count()
            start = (page - 1) * per_page
            bases = list(qs[start : start + per_page])
            config_list = [
                {
                    "id": str(b.id),
                    "type": b.type,
                    "type_display": AUTH_TYPE_DISPLAY.get(b.type, b.type),
                    "is_enabled": b.is_enabled,
                    "created_at": b.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                }
                for b in bases
            ]
            return {
                "auth_config_list": config_list,
                "paginator_info": {"page": page, "per_page": per_page, "total": total},
            }
        except Exception as e:
            logger.error(f"Failed to get Auth config list: {str(e)}")
            raise CustomCommonException(f"Failed to get Auth config list: {str(e)}")

    def get_auth_config_detail(self, tenant_id: str, config_id: str) -> dict:
        base, ext = _get_base_and_ext(tenant_id, config_id)
        if not base or not ext:
            raise CustomCommonException("Auth config not found")
        result = {
            "id": str(base.id),
            "type": base.type,
            "type_display": AUTH_TYPE_DISPLAY.get(base.type, base.type),
            "is_enabled": base.is_enabled,
            "description": base.description,
            "created_at": base.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "client_id": ext.client_id,
            "client_secret": _safe_decrypt(ext.client_secret),
            "redirect_uri": ext.redirect_uri,
        }
        if isinstance(ext, WecomAuthConfig):
            result["agent_id"] = ext.agent_id
        else:
            result["azure_tenant_id"] = ext.azure_tenant_id
        return result


auth_service_ins = AuthService()

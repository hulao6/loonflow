from django.db import models
from apps.loon_base_model import BaseCommonModel


class Notification(BaseCommonModel):
    """
    notice config, need encrypt
    """
    NOTICE_TYPE_CHOICE = [
        ("dingtalk", "dingtalk"),
        ("wecom", "wecom"),
        ("feishu", "feishu"),
        ("hook", "hook")
    ]
    name = models.CharField("name", max_length=50, null=False, default="")
    description = models.CharField("description", max_length=200, null=False, default="")
    type = models.CharField("type", max_length=50, null=False, default="")
    extra = models.JSONField("extra", max_length=1000, null=False)


class BaseAuth(BaseCommonModel):
    """
    translate to english: base auth table for auth config, detail config is in wecom auth config or microsoft oidc auth config
    """
    AUTH_TYPE_CHOICE = [
        ("wecom", "wecom"),
        ("microsoft_oidc", "microsoft_oidc"),
    ]
    type = models.CharField("type", max_length=50, null=False, choices=AUTH_TYPE_CHOICE, help_text="Authentication type")
    is_enabled = models.BooleanField("is_enabled", null=False, default=False)
    description = models.CharField("description", max_length=500, null=False, default="", blank=True)


class WecomAuthConfig(BaseCommonModel):
    """
    base auth table for wecom auth config
    """
    base_auth = models.ForeignKey(BaseAuth, db_constraint=False, on_delete=models.DO_NOTHING, related_name="wecom_config")
    client_id = models.CharField("client_id", max_length=200, null=False, default="", help_text="Wecom Corp ID")
    client_secret = models.CharField("client_secret", max_length=500, null=False, default="", help_text="Wecom Corp Secret")
    redirect_uri = models.CharField("redirect_uri", max_length=500, null=False, default="")
    agent_id = models.CharField("agent_id", max_length=100, null=False, default="",
                                help_text="Agent ID")


class MicrosoftOidcAuthConfig(BaseCommonModel):
    """
    translate to english: base auth table for microsoft oidc auth config
    """
    base_auth = models.ForeignKey(BaseAuth, db_constraint=False, on_delete=models.DO_NOTHING, related_name="microsoft_oidc_config")
    client_id = models.CharField("client_id", max_length=200, null=False, default="", help_text="Application (client) ID")
    client_secret = models.CharField("client_secret", max_length=500, null=False, default="", help_text="Application Secret")
    redirect_uri = models.CharField("redirect_uri", max_length=500, null=False, default="", help_text="Redirect URI")
    azure_tenant_id = models.CharField("azure_tenant_id", max_length=200, null=False, default="", help_text="Directory (tenant) ID")

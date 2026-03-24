from django.urls import path
from apps.manage.views import index, CommonConfigView, NotificationView, SimpleNotificationView, NotificationDetailView
from apps.manage.auth_views import (
    AuthConfigView,
    AuthConfigDetailView,
    AuthLoginView,
    AuthWecomAuthView,
    AuthWecomCallbackView,
    AuthMicrosoftOidcAuthView,
    AuthMicrosoftOidcCallbackView,
)

urlpatterns = [
    path("", index),
    path("/common", CommonConfigView.as_view()),
    path("/notifications", NotificationView.as_view()),
    path("/simple_notifications", SimpleNotificationView.as_view()),
    path("/notifications/<str:notification_id>", NotificationDetailView.as_view()),
    # Auth 配置管理
    path("/auth_configs", AuthConfigView.as_view()),
    path("/auth_configs/<str:config_id>", AuthConfigDetailView.as_view()),
    # Auth 登录
    path("/auth/login", AuthLoginView.as_view()),
    path("/auth/wecom/auth", AuthWecomAuthView.as_view()),
    path("/auth/wecom/callback", AuthWecomCallbackView.as_view()),
    path("/auth/microsoft_oidc/auth", AuthMicrosoftOidcAuthView.as_view()),
    path("/auth/microsoft_oidc/callback", AuthMicrosoftOidcCallbackView.as_view()),
]

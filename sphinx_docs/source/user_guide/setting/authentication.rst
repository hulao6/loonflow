Authentication Management
=========================

Loonflow supports multiple authentication methods. You can configure them in the "Setting"-"Authentication" page. Currently, the supported authentication methods are:

- Microsoft OIDC: Microsoft OIDC authentication.
- WeCom: WeCom authentication.



Microsoft OIDC authentication
-----------------------------
Microsoft OIDC authentication is supported by Microsoft OIDC.

your need create a Microsoft OIDC app and get the client id, client secret, redirect uri.
   .. figure:: ../../images/create_microsoft_oidc_app.png
      :width: 100%
      :align: center
      :alt: create new microsoft oidc app

add redirect url, your service must listen on https,and the redirect must use be https://{your domain}/api/v1.0/manage/auth/microsoft_oidc/callback
   .. figure:: ../../images/add_microsoft_oidc_redirect_url.png
      :width: 100%
      :align: center
      :alt: microsoft oidc redirect url


WeCom authentication
--------------------
WeCom authentication is supported by WeCom. support use wecom scan QR code to login.

your need create a wecom app and get the appid, agentid, redirect uri.
   .. figure:: ../../images/wecom_new_app.png
      :width: 100%
      :align: center
      :alt: create new wecom app

web app authorization configure
   .. figure:: ../../images/wecom_app_authorization_01.png
      :width: 100%
      :align: center
      :alt: create new wecom app

add callback domain
   .. figure:: ../../images/wecom_app_authorization_02.png
      :width: 100%
      :align: center
      :alt: new wecom app callback domain

add Company's Trusted IP
   .. figure:: ../../images/wecom_add_trustted_ip.png
      :width: 100%
      :align: center
      :alt: add company's trusted ip


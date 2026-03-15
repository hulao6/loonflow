from settings.common import *

DEBUG = os.getenv('DEBUG', 'False').lower() == 'true'
LOGGING_LEVEL = os.getenv('LOGGING_LEVEL', 'INFO').upper()

ALLOWED_HOSTS = ['*']
MIDDLEWARE = [
    'service.csrf_service.DisableCSRF',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'service.permission.app_permission.AppPermissionCheck',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

MEDIA_ROOT = os.path.join(BASE_DIR, 'media')
MEDIA_URL = '/media/'

# Database
# https://docs.djangoproject.com/en/1.11/ref/settings/#databases

DATABASES = {
    'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.getenv('DB_NAME', 'loonflow'),
            'USER': os.getenv('DB_USER', 'loonflow'),
            'PASSWORD': os.getenv('DB_PASS', '123456'),
            'HOST': os.getenv('DB_HOST', '127.0.0.1'),
            'PORT': os.getenv('POSTGRES_PORT', '5432')
        }
}

REDIS_HOST = os.getenv('REDIS_HOST', '127.0.0.1')
REDIS_PORT = os.getenv('REDIS_PORT', 6379)
REDIS_DB = os.getenv('REDIS_DB', 0)
REDIS_PASSWORD = os.getenv('REDIS_PASSWORD', '')

if REDIS_PASSWORD:
    CELERY_BROKER_URL = 'redis://:{}@{}:{}/{}'.format(REDIS_PASSWORD, REDIS_HOST, REDIS_PORT, REDIS_DB)
else:
    CELERY_BROKER_URL = 'redis://{}:{}/{}'.format(REDIS_HOST, REDIS_PORT, REDIS_DB)

HOOK_HOST_FORBIDDEN = []  # host list that not allowed be used as hook url(include state hook and notice hook), such as ['192,168.1.12', '*.baidu.com'], if no this setting key means allow all


JWT_SALT = os.getenv('JWT_SALT', 'aUApFqfQjyYVAPo8')
ENCRYPTION_KEY = os.getenv('ENCRYPTION_KEY', '2VLMQOroSgJUC68n30X9VzFkUPzN0oYpprGlwy/ffmk=')   # you can generate your key, refer to document


LOGGING = {
        'version': 1,
        'disable_existing_loggers': False,
        'filters': {
            'require_debug_true': {
                '()': 'django.utils.log.RequireDebugTrue',
            },
        },
        'formatters': {
            'standard': {
                'format': '%(asctime)s %(pathname)s process-%(process)d thread-%(thread)d %(lineno)d [%(levelname)s]: %(message)s',
            },
        },
        'handlers': {
            'file_handler': {
                'level': LOGGING_LEVEL,
                'class': 'logging.FileHandler',
                'filename': HOMEPATH + '/loonflow.log',
                'formatter': 'standard'
            },
            'console': {
                'level': LOGGING_LEVEL,
                'filters': ['require_debug_true'],
                'class': 'logging.StreamHandler',
                'formatter': 'standard'
            },
        },
        'loggers': {
            'django': {
                'handlers': ['file_handler'],
                'propagate': True,
                'level': LOGGING_LEVEL,
                        },
            'django.db.backends': {
                'handlers': ['console'],
                'propagate': True,
                'level': LOGGING_LEVEL,
            }
        }
    }

import json
import logging
import re
import time
import traceback
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from urllib.parse import parse_qsl, urlparse, urlencode, urlunparse

import requests
from django.conf import settings

from apps.ticket.models import CustomField as TicketCustomField
from service.ticket.ticket_user_service import ticket_user_service_ins
from service.account.account_base_service import account_base_service_ins
from service.account.account_user_service import account_user_service_ins
from service.workflow.workflow_base_service import workflow_base_service_ins
from service.base_service import BaseService
from service.workflow.workflow_component_service import workflow_component_service_ins
from apps.ticket.models import Record as TicketRecord
from service.common.common_service import common_service_ins

logger = logging.getLogger('django')

# Match src="/api/..." or href='/api/...' in rich text HTML for ticket upload URLs.
_TICKET_UPLOAD_HTML_ATTR_RE = re.compile(
    r'(?P<attr>\b(?:src|href)\s*=\s*)(?P<q>["\'])(?P<path>/api/v1\.0/tickets/[^"\']+)(?P=q)',
    re.IGNORECASE,
)


class TicketFieldService(BaseService):
    """
    ticket field service
    """
    @classmethod
    def get_field_value_column(cls, field_type: str) -> str:
        """
        get what the column about field's value should save to
        :param field_type:
        :return:
        """
        if field_type in ["text", "select", "cascade", "user", "department", "field", "radio", "checkbox"]:
            return "common_value"
        elif field_type == "number":
            return "number_value"
        elif field_type == "date":
            return "date_value"
        elif field_type == "datetime":
            return "datetime_value"
        elif field_type == "time":
            return "time_value"
        elif field_type in ["richtext", "textarea", "file"]:
            return "rich_text_value"


    @classmethod
    def json_safe_ticket_fields(cls, payload: dict) -> dict:
        """Convert ticket field dict to JSON-serializable values for external POST body."""

        def _convert(v):
            if v is None:
                return None
            if isinstance(v, dict):
                return {k: _convert(x) for k, x in v.items()}
            if isinstance(v, (list, tuple)):
                return [_convert(x) for x in v]
            if isinstance(v, Decimal):
                return float(v)
            if hasattr(v, 'isoformat'):
                return v.isoformat()
            if isinstance(v, (str, int, float, bool)):
                return v
            return str(v)

        return {k: _convert(v) for k, v in payload.items()}

    @classmethod
    def merge_display_style_into_data_source_url(cls, url: str, display_style: str) -> str:
        """
        Append displayStyle query param for the remote endpoint (e.g. mock) to shape demo payloads.
        Replaces existing displayStyle / style query keys so the form config is the source of truth.
        """
        if not url:
            return url
        ds = (display_style or '').strip() or 'text'
        parsed = urlparse(url)
        pairs = [
            (k, v)
            for k, v in parse_qsl(parsed.query, keep_blank_values=True)
            if k not in ('displayStyle', 'style')
        ]
        pairs.append(('displayStyle', ds))
        new_query = urlencode(pairs)
        return urlunparse(
            (parsed.scheme, parsed.netloc, parsed.path, parsed.params, new_query, parsed.fragment)
        )

    @classmethod
    def validate_external_data_source_url(cls, url: str) -> tuple:
        """
        Allow only http(s) with a host to reduce SSRF / ambiguous relative-URL behavior.
        Returns (True, '') or (False, error_message).
        """
        if not url or not isinstance(url, str):
            return False, 'data source url is empty'
        parsed = urlparse(url.strip())
        if parsed.scheme not in ('http', 'https'):
            return False, 'data source url must use http or https'
        if not parsed.netloc:
            return False, 'data source url must include a host'
        return True, ''

    @classmethod
    def fetch_external_data_source_value(
        cls,
        data_source_url: str,
        token: str,
        fields_payload: dict,
        log_field_key: str = '',
    ) -> tuple:
        """
        POST to external data source with hook-style signature headers.
        Returns (ok, value, error_message).
        """
        import fnmatch

        ok_url, url_err = cls.validate_external_data_source_url(data_source_url)
        if not ok_url:
            if log_field_key:
                logger.warning(
                    'external_data_source invalid url field_key=%s err=%s',
                    log_field_key,
                    url_err,
                )
            return False, None, url_err

        hook_url_forbidden_list = getattr(settings, 'HOOK_HOST_FORBIDDEN', [])
        for url in hook_url_forbidden_list:
            if fnmatch.fnmatch(data_source_url, url):
                return False, None, 'hook url is blocked, please contact system administrator'
        signature, timestamp = common_service_ins.gen_signature_by_token(token)
        headers = dict(signature=signature, timestamp=timestamp)
        parsed = urlparse(data_source_url)
        try:
            t0 = time.perf_counter()
            r = requests.post(
                data_source_url,
                headers=headers,
                json=fields_payload,
                timeout=15,
            )
            r.raise_for_status()
            try:
                result = r.json()
            except ValueError:
                logger.warning(
                    'external_data_source non-JSON body field_key=%s host=%s status=%s bytes=%s',
                    log_field_key or '-',
                    parsed.netloc,
                    r.status_code,
                    len(r.content or b''),
                )
                return False, None, 'external data source returned non-JSON response'
            elapsed_ms = (time.perf_counter() - t0) * 1000
            logger.info(
                'external_data_source fetch field_key=%s host=%s status=%s elapsed_ms=%.1f',
                log_field_key or '-',
                parsed.netloc,
                r.status_code,
                elapsed_ms,
            )
        except requests.exceptions.RequestException as e:
            logger.warning(
                'external_data_source request failed field_key=%s host=%s err=%s',
                log_field_key or '-',
                parsed.netloc,
                e,
            )
            return False, None, str(e)
        except Exception as e:
            logger.error(traceback.format_exc())
            return False, None, str(e)
        if not isinstance(result, dict):
            return False, None, 'external data source returned invalid JSON structure'
        if result.get('code') != 0:
            return False, None, result.get('msg') or 'external data source returned error'
        data = result.get('data') or {}
        return True, data.get('value'), ''

    @classmethod
    def apply_external_data_source_fields_to_form(cls, component_result_list: list, ticket_field_value_dict: dict) -> None:
        """Fill externaldata field values; remove token from props in the response."""
        payload = cls.json_safe_ticket_fields(ticket_field_value_dict)
        work_items = []

        for component in component_result_list:
            if component.get('type') != 'row':
                continue
            for field_component in component.get('children') or []:
                if field_component.get('type') != 'externaldata':
                    continue
                props = field_component.setdefault('props', {})
                field_component['component_permission'] = 'readonly'
                url = props.get('dataSourceUrl') or props.get('data_source_url')
                token = props.get('dataSourceToken') or props.get('data_source_token')
                props.pop('dataSourceToken', None)
                props.pop('data_source_token', None)
                field_key = field_component.get('component_key') or ''
                if not url or not token:
                    props['externalDataError'] = 'missing_config'
                    props['value'] = None
                    continue
                display_style = props.get('displayStyle') or props.get('display_style') or 'text'
                request_url = cls.merge_display_style_into_data_source_url(url, display_style)
                work_items.append((field_component, request_url, token, field_key))

        if not work_items:
            return

        max_workers = max(1, min(8, len(work_items)))

        def _fetch_one(item):
            field_component, request_url, token, fk = item
            return (
                field_component,
                cls.fetch_external_data_source_value(
                    request_url,
                    token,
                    payload,
                    log_field_key=fk,
                ),
            )

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            results = list(executor.map(_fetch_one, work_items))

        for field_component, (ok, value, err) in results:
            props = field_component.setdefault('props', {})
            props['value'] = value if ok else None
            if not ok:
                props['externalDataError'] = err

    @classmethod
    def _is_ticket_upload_api_path(cls, path: str) -> bool:
        """Paths accepted by gen_file_temp_token: .../tickets/{tenant}/{draft|ticket_id}/files/{name}."""
        p = path.split('?')[0].strip()
        return bool(re.match(
            r'^/api/v1\.0/tickets/[^/]+/[^/]+/files/[^/]+$',
            p,
        ))

    @classmethod
    def _append_temp_tokens_to_rich_text(cls, html: str) -> str:
        if not html or not isinstance(html, str):
            return html

        def repl(match: re.Match) -> str:
            attr = match.group('attr')
            q = match.group('q')
            raw_path = match.group('path')
            base_path = raw_path.split('?')[0].strip()
            if not cls._is_ticket_upload_api_path(base_path):
                return match.group(0)
            try:
                timestamp, token = common_service_ins.gen_file_temp_token(base_path)
            except (IndexError, ValueError, TypeError):
                return match.group(0)
            new_url = f'{base_path}?token={token}&timestamp={timestamp}'
            return f'{attr}{q}{new_url}{q}'

        return _TICKET_UPLOAD_HTML_ATTR_RE.sub(repl, html)

    @classmethod
    def get_ticket_all_field_value(cls, tenant_id: str, ticket_id: str) -> dict:
        """
        get ticket all field value
        :param tenant_id:
        :param ticket_id:
        :return:
        """
        ticket_obj_queryset = TicketCustomField.objects.filter(ticket_id=ticket_id, tenant_id=tenant_id).all()
        result_dict = {}
        for ticket_custom_field in ticket_obj_queryset:
            if ticket_custom_field.field_type in ("text", "select", "cascade", "user", "department"):
                result_dict[ticket_custom_field.field_key] = ticket_custom_field.common_value
            elif ticket_custom_field.field_type == "file":
                source_vaule = ticket_custom_field.rich_text_value
                source_value_list = json.loads(source_vaule)
                new_value_list = []
                for item in source_value_list:
                    file_path = item.get('file_path') or ''
                    timestamp, token = common_service_ins.gen_file_temp_token(file_path.split('?')[0])
                    file_path = file_path.split('?')[0] + f"?token={token}&timestamp={timestamp}"
                    new_value_list.append(dict(item, file_path=file_path))
                new_value = json.dumps(new_value_list, ensure_ascii=False)
                result_dict[ticket_custom_field.field_key] = new_value
            elif ticket_custom_field.field_type == "number":
                result_dict[ticket_custom_field.field_key] = ticket_custom_field.number_value
            elif ticket_custom_field.field_type == "date":
                result_dict[ticket_custom_field.field_key] = ticket_custom_field.date_value
            elif ticket_custom_field.field_type == "datetime":
                result_dict[ticket_custom_field.field_key] = ticket_custom_field.datetime_value
            elif ticket_custom_field.field_type == "time":
                result_dict[ticket_custom_field.field_key] = ticket_custom_field.time_value
            elif ticket_custom_field.field_type in ["richtext", "textarea"]:
                source_value = ticket_custom_field.rich_text_value
                result_dict[ticket_custom_field.field_key] = cls._append_temp_tokens_to_rich_text(
                    source_value,
                )
            else:
                result_dict[ticket_custom_field.field_key] = ticket_custom_field.common_value
        basic_info_dict = cls.get_ticket_basic_field_value(tenant_id, ticket_id)
        result_dict.update(basic_info_dict)
        return result_dict


    @classmethod
    def get_ticket_basic_field_value(cls, tenant_id: str, ticket_id: str) -> dict:
        """
        get ticket basic field value
        :param tenant_id:
        :param ticket_id:
        :return:
        """
        result_dict = {}
        ticket_obj = TicketRecord.objects.get(id=ticket_id, tenant_id=tenant_id)
        result_dict['title'] = ticket_obj.title
        result_dict['act_state'] = ticket_obj.act_state
        result_dict['parent_ticket_id'] = ticket_obj.parent_ticket_id
        result_dict['parent_ticket_node_id'] = ticket_obj.parent_ticket_node_id
        result_dict['workflow_id'] = str(ticket_obj.workflow_id)
        result_dict['workflow_version_id'] = str(ticket_obj.workflow_version_id)
        result_dict['created_at'] = ticket_obj.created_at
        # todo: 
        from service.ticket.ticket_node_service import ticket_node_service_ins
        ticket_nodes = ticket_node_service_ins.get_ticket_current_nodes(tenant_id, ticket_id)
        ticket_node_infos = []
        for ticket_node in ticket_nodes:
            ticket_node_infos.append(dict(
                id = str(ticket_node.node_id),
                name = ticket_node.node.name,
            ))
        result_dict['ticket_node_infos'] = ticket_node_infos
        
        # todo： get ticket current assignee , 1. get ticket node,  2.get node assigneef
        from service.ticket.ticket_node_service import ticket_node_service_ins
        ticket_nodes = ticket_node_service_ins.get_ticket_current_nodes(tenant_id, ticket_id)
        current_assignee_info_list = []
        
        for ticket_node in ticket_nodes:
            if ticket_node.assignee_type == "users":
                user_record_list = account_user_service_ins.get_user_list_by_id_list(tenant_id, ticket_node.assignee.split(','))
                assignee_list = []
                for user_record in user_record_list:
                    assignee_list.append(f'{user_record.name}({user_record.alias})')
                current_assignee_info_list.append(dict(
                    node_name = ticket_node.node.name,
                    assignee_type = "users",
                    assignee = ','.join(assignee_list)
                ))
            elif ticket_node.assignee_type == "hooks":
                current_assignee_info_list.append(dict(
                    node_name = ticket_node.node.name,
                    assignee_type = "hooks",
                    assignee = "*"
                ))
        result_dict['current_assignee_infos'] = current_assignee_info_list
        
        # add creator_info
        creator_info = account_user_service_ins.get_user_by_user_id(tenant_id, ticket_obj.creator_id)
        result_dict['creator_info'] = dict(
            id = str(creator_info.id),
            name = creator_info.name,
            alias = creator_info.alias if creator_info.alias else '',
            email = creator_info.email if creator_info.email else '',
            phone = creator_info.phone if creator_info.phone else '',
        )
        #add workflow_info
        workflow_info =workflow_base_service_ins.get_workflow_info_by_id_and_version_id(tenant_id, ticket_obj.workflow_id, ticket_obj.workflow_version_id)
        result_dict['workflow_info'] = dict(
            id = workflow_info.get('workflow_id'),
            name = workflow_info.get('name'),
            description = workflow_info.get('description'),
        )
        
        return result_dict

    @classmethod
    def get_ticket_field_value(cls, tenant_id: str, ticket_id: str, field_key: str):
        """
        get ticket custom field queryset
        :param tenant_id:
        :param ticket_id:
        :return:
        """
        result_dict = {}
        ticket_custom_field_obj = TicketCustomField.objects.get(ticket_id=ticket_id, tenant_id=tenant_id, field_key=field_key)
        if ticket_custom_field_obj.field_type in ("text", "select", "cascade", "user"):
            result_dict[ticket_custom_field_obj.field_key] = ticket_custom_field_obj.common_value
        elif ticket_custom_field_obj.field_type == "file":
            result_dict[ticket_custom_field_obj.field_key] = ticket_custom_field_obj.rich_text_value
        elif ticket_custom_field_obj.field_type == "number":
            result_dict[ticket_custom_field_obj.field_key] = ticket_custom_field_obj.number_value
        elif ticket_custom_field_obj.field_type == "date":
            result_dict[ticket_custom_field_obj.field_key] = ticket_custom_field_obj.date_value
        elif ticket_custom_field_obj.field_type == "richtext":
            result_dict[ticket_custom_field_obj.field_key] = ticket_custom_field_obj.rich_text_value
        else:
            result_dict[ticket_custom_field_obj.field_key] = ticket_custom_field_obj.common_value
            
        return result_dict[field_key]

    @classmethod
    def update_ticket_fields(cls, tenant_id: str, ticket_id:str, operator_id: str, workflow_id: str, version_id: str, field_info_dict: dict) -> bool:
        """
        add ticket custom field record
        :param tenant_id:
        :param ticket_id:
        :param operator_id:
        :param workflow_id:
        :param version_id:
        :param field_info_dict:
        :return:
        """
        for field_key, field_value in field_info_dict.items():
            if field_key == 'title':
                TicketRecord.objects.filter(id=ticket_id, tenant_id=tenant_id).update(title=field_value)


        workflow_custom_field_queryset = workflow_component_service_ins.get_workflow_custom_fields(tenant_id, workflow_id, version_id)
        field_key_type_dict = {}
        for workflow_custom_field in workflow_custom_field_queryset:
            field_key_type_dict[workflow_custom_field['component_key']] = workflow_custom_field['type']
        
        need_update_field_value_list, need_add_field_value_list = [], []
        ticket_custom_field_queryset = TicketCustomField.objects.filter(ticket_id=ticket_id, tenant_id=tenant_id).all()
        exist_field_key_list = [ticket_custom_field.field_key for ticket_custom_field in ticket_custom_field_queryset]
        for field_key in field_info_dict.keys():
            if field_key == 'title' or field_key not in field_key_type_dict:
                continue
            if field_key_type_dict.get(field_key) == 'externaldata':
                continue
            raw_value = field_info_dict.get(field_key)
            field_type = field_key_type_dict.get(field_key)
            if field_type == 'file' and isinstance(raw_value, list):
                # remove token and timestamp from file_path
                new_value = []
                for item in raw_value:
                    file_path = item.get('file_path') or ''
                    file_path = file_path.split('?')[0]
                    new_value.append(dict(item, file_path=file_path))
                raw_value = new_value
                store_value = json.dumps(raw_value, ensure_ascii=False)
            elif type(raw_value) == list:
                store_value = ','.join(str(x) for x in raw_value)
            else:
                store_value = raw_value
            if field_key in exist_field_key_list:
                need_update_field_value_list.append({field_key: store_value})
            else:
                need_add_field_value_list.append({field_key: store_value})


        for need_update_field_value in need_update_field_value_list:
            field_key = list(need_update_field_value.keys())[0]
            field_value_column = cls.get_field_value_column(field_key_type_dict.get(field_key))
            TicketCustomField.objects.filter(ticket_id=ticket_id, tenant_id=tenant_id, field_key=field_key).update(**{field_value_column: need_update_field_value[field_key]})

        for need_add_field_value in need_add_field_value_list:
            field_key = list(need_add_field_value.keys())[0]
            field_value_column = cls.get_field_value_column(field_key_type_dict.get(field_key))
            if field_value_column:
                TicketCustomField.objects.create(ticket_id=ticket_id, tenant_id=tenant_id, field_key=field_key, 
                                                field_type=field_key_type_dict.get(field_key), **{field_value_column: need_add_field_value[field_key]})
        return True


ticket_field_service_ins = TicketFieldService()

import TextField from './TextField';
import NumberField from './NumberField';
import TextAreaField from './TextAreaField';
import SelectField from './SelectField';
import RadioField from './RadioField';
import CheckboxField from './CheckboxField';
import TimeField from './TimeField';
import DateField from './DateField';
import DateTimeField from './DateTimeField';
import FileField from './FileField';
import RichTextField from './RichTextField';
import UserField from './UserField';
import DepartmentField from './DepartmentField';
import TicketCreatorField from './TicketCreatorField';
import TicketCreatedAtField from './TicketCreateAtField';
import TicketNodesField from './TicketNodesField';
import TicketActStateField from './TicketActStateField';
import WorkflowInfoField from './WorkflowInfoField';
import TicketCurrentAssigneeInfosField from './TicketCurrentAssigneeInfosField';
import ExternalDataField from './ExternalDataField';

// 导出所有字段组件
export { default as TextField } from './TextField';
export { default as NumberField } from './NumberField';
export { default as TextAreaField } from './TextAreaField';
export { default as SelectField } from './SelectField';
export { default as RadioField } from './RadioField';
export { default as CheckboxField } from './CheckboxField';
export { default as TimeField } from './TimeField';
export { default as DateField } from './DateField';
export { default as DateTimeField } from './DateTimeField';
export { default as FileField } from './FileField';
export { default as RichTextField } from './RichTextField';
export { default as UserField } from './UserField';
export { default as DepartmentField } from './DepartmentField';
export { default as TicketCreatorField } from './TicketCreatorField';
export { default as TicketCreatedAtField } from './TicketCreateAtField';
export { default as TicketNodesField } from './TicketNodesField';
export { default as TicketActStateField } from './TicketActStateField';
export { default as WorkflowInfoField } from './WorkflowInfoField';
export { default as TicketCurrentAssigneeInfosField } from './TicketCurrentAssigneeInfosField';
export { default as ExternalDataField } from './ExternalDataField';

// 导出类型定义
export type { BaseFieldProps, FieldComponentConfig } from './types';

// 字段类型到组件的映射
export const fieldComponentMap = {
    text: TextField,
    textarea: TextAreaField,
    number: NumberField,
    select: SelectField,
    radio: RadioField,
    checkbox: CheckboxField,
    time: TimeField,
    date: DateField,
    datetime: DateTimeField,
    file: FileField,
    richtext: RichTextField,
    richText: RichTextField,
    user: UserField,
    department: DepartmentField,
    creator: TicketCreatorField,
    created_at: TicketCreatedAtField,
    ticket_node_infos: TicketNodesField,
    act_state: TicketActStateField,
    workflow_info: WorkflowInfoField,
    current_assignee_infos: TicketCurrentAssigneeInfosField,
    externaldata: ExternalDataField,
    // 可以继续添加更多字段类型
};

// 获取字段组件的函数
export const getFieldComponent = (fieldType: string) => {
    return fieldComponentMap[fieldType as keyof typeof fieldComponentMap] || TextField;
}; 
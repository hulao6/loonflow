import i18n from '../../../../i18n';
import { IWorkflowFullDefinition } from '../../../../types/workflow';
import { getValidationMessage } from './i18n';

/**
 * Validate form schema
 * @param workflowData Complete workflow definition data
 * @returns List of form validation problems
 */
export const validateFormSchema = (workflowData: IWorkflowFullDefinition): string[] => {
    const problems: string[] = [];

    // Check if form design is empty
    if (workflowData.formSchema.componentInfoList.length === 0) {
        problems.push(getValidationMessage('form', 'formDesignEmpty'));
    }

    // Check if every row component has children
    for (const component of workflowData.formSchema.componentInfoList) {
        if (component.type === 'row') {
            if (component.children.length === 0) {
                problems.push(getValidationMessage('form', 'rowComponentNoChildren'));
            }
        }
    }

    // Flatten components (fields inside rows and top-level fields)
    const allComponents = workflowData.formSchema.componentInfoList.flatMap((component: any) => {
        if (component.type === 'row') {
            return component.children || [];
        }
        return [component];
    });

    // Rule: title component MUST exist exactly once
    const titleComponents = allComponents.filter((c: any) => c.type === 'title');
    if (titleComponents.length !== 1) {
        problems.push(getValidationMessage('form', 'titleComponentCountError', {
            count: titleComponents.length
        }));
    }

    // External data fields need URL and token (aligned with backend apply_external_data_source_fields_to_form)
    for (const c of allComponents) {
        if (c.type !== 'externaldata') continue;
        const props = c.props || {};
        const url = String(props.dataSourceUrl ?? props.data_source_url ?? '').trim();
        const token = String(props.dataSourceToken ?? props.data_source_token ?? '').trim();
        const rawLabel = String((c.componentName || '').trim() || (c.componentKey || '')).trim();
        const fieldName = rawLabel || (i18n.t('common.unnamed') as string);
        if (!url) {
            problems.push(getValidationMessage('form', 'externalDataUrlRequired', { fieldName }));
        }
        if (!token) {
            problems.push(getValidationMessage('form', 'externalDataTokenRequired', { fieldName }));
        }
    }

    return problems;
};

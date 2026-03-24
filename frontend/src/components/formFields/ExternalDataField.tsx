import React from 'react';
import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { IProps } from '../../types/workflow';

export interface ExternalDataFieldProps {
    value?: unknown;
    props?: IProps;
}

function formatJson(value: unknown): string {
    if (value === undefined || value === null) {
        return '';
    }
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}

function ExternalDataField({ value, props: fieldProps }: ExternalDataFieldProps): React.ReactElement {
    const { t } = useTranslation();
    const displayStyle = (fieldProps?.displayStyle as 'json' | 'key_value' | 'text' | undefined) || 'text';
    const err = fieldProps?.externalDataError as string | undefined;

    if (err) {
        return (
            <Typography color="error" variant="body2">
                {t('ticket.externalData.loadError', { message: err })}
            </Typography>
        );
    }

    if (value === undefined || value === null || value === '') {
        return (
            <Typography color="text.secondary" variant="body2">
                {t('ticket.externalData.empty')}
            </Typography>
        );
    }

    if (displayStyle === 'json') {
        return (
            <Box
                component="pre"
                sx={{
                    m: 0,
                    p: 1,
                    typography: 'body2',
                    bgcolor: 'action.hover',
                    borderRadius: 1,
                    overflow: 'auto',
                    maxHeight: 320,
                }}
            >
                {formatJson(value)}
            </Box>
        );
    }

    if (displayStyle === 'key_value' && value !== null && typeof value === 'object' && !Array.isArray(value)) {
        const entries = Object.entries(value as Record<string, unknown>);
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {entries.map(([k, v]) => (
                    <Typography key={k} variant="body2">
                        <strong>{k}</strong>
                        {': '}
                        {typeof v === 'object' ? formatJson(v) : String(v)}
                    </Typography>
                ))}
            </Box>
        );
    }

    if (displayStyle === 'key_value' && Array.isArray(value)) {
        return (
            <Box component="pre" sx={{ m: 0, typography: 'body2', whiteSpace: 'pre-wrap' }}>
                {formatJson(value)}
            </Box>
        );
    }

    return (
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {typeof value === 'object' ? formatJson(value) : String(value)}
        </Typography>
    );
}

export default ExternalDataField;

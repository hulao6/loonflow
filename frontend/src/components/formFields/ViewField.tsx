import { Box, Chip, Typography } from "@mui/material";
import { useEffect, useState } from 'react';
import { getDeptPaths } from '../../services/dept';
import { getSimpleUsers } from '../../services/user';
import { ISimpleDeptPath } from '../../types/dept';
import { ISimpleUser } from '../../types/user';

interface ViewFieldProps {
    type: string;
    value: string | string[];
    props: any;
}

function ViewField({
    type,
    value,
    props
}: ViewFieldProps) {
    const [displayValue, setDisplayValue] = useState<string>('');

    // 处理用户和部门类型的显示
    useEffect(() => {
        const handleUserOrDeptDisplay = async () => {
            if (type === 'user' || type === 'department') {
                if (!value || value === '-' || (Array.isArray(value) && value.length === 0)) {
                    setDisplayValue('');
                    return;
                }

                try {
                    if (type === 'user') {
                        const userIds = Array.isArray(value) ? value.join(',') : value;
                        const response = await getSimpleUsers('', userIds, 1, 1000);
                        if (response.code === 0) {
                            const userNames = response.data.userInfoList.map((user: ISimpleUser) =>
                                `${user.name}(${user.alias})`
                            );
                            setDisplayValue(userNames.join(', '));
                        } else {
                            setDisplayValue(Array.isArray(value) ? value.join(', ') : value);
                        }
                    } else if (type === 'department') {
                        const deptIds = Array.isArray(value) ? value.join(',') : value;
                        const response = await getDeptPaths('', deptIds, 1, 1000);
                        if (response.code === 0) {
                            const deptNames = response.data.deptPathList.map((dept: ISimpleDeptPath) =>
                                dept.name
                            );
                            setDisplayValue(deptNames.join(', '));
                        } else {
                            setDisplayValue(Array.isArray(value) ? value.join(', ') : value);
                        }
                    }
                } catch (error) {
                    console.error('获取显示信息失败:', error);
                    setDisplayValue(Array.isArray(value) ? value.join(', ') : value);
                }
            } else {
                // 处理其他类型
                let computedValue = '';
                if (type === 'datetime') {
                    const date = new Date(value as string);
                    computedValue = date.toLocaleString(undefined, { hour12: false });
                } else if (type === 'date') {
                    const date = new Date(value as string);
                    computedValue = date.toLocaleDateString();
                } else if (type === 'time') {
                    // 如果是纯时间格式（HH:mm 或 HH:mm:ss），直接显示
                    if (/^\d{2}:\d{2}(:\d{2})?$/.test(value as string)) {
                        computedValue = value as string;
                    } else {
                        // 如果是ISO格式，解析并提取时间部分
                        const date = new Date(value as string);
                        if (!isNaN(date.getTime())) {
                            computedValue = date.toLocaleTimeString(undefined, { hour12: false });
                        } else {
                            computedValue = value as string;
                        }
                    }
                } else if (type === 'file') {
                    // 文件类型特殊处理
                    if (!value || value === '-') {
                        computedValue = '';
                    } else {
                        try {
                            const files = JSON.parse(value as string);
                            if (Array.isArray(files) && files.length > 0) {
                                computedValue = files.map((file: any) => file.name || file).join(', ');
                            } else {
                                computedValue = value as string;
                            }
                        } catch {
                            computedValue = value as string;
                        }
                    }
                } else {
                    if (value !== null && typeof value === 'object') {
                        try {
                            computedValue = JSON.stringify(value, null, 2);
                        } catch {
                            computedValue = String(value);
                        }
                    } else {
                        computedValue = String(value ?? '');
                    }
                }
                setDisplayValue(computedValue);
            }
        };

        handleUserOrDeptDisplay();
    }, [type, value]);


    // 文件类型特殊渲染
    if (type === 'file' && displayValue !== '-') {
        try {
            const files = JSON.parse(value as string);
            if (Array.isArray(files) && files.length > 0) {
                return (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {files.map((file: any, index: number) => (
                            <Chip
                                key={index}
                                label={file.name || file}
                                size="small"
                                variant="outlined"
                                icon={<span>📎</span>}
                            />
                        ))}
                    </Box>
                );
            }
        } catch {
            // 如果解析失败，回退到普通文本显示
        }
    }

    // 用户和部门类型特殊渲染（多选时显示为Chip）
    if ((type === 'user' || type === 'department') && Array.isArray(value) && value.length > 0 && displayValue !== '-') {
        const items = displayValue.split(', ');
        return (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {items.map((item: string, index: number) => (
                    <Chip
                        key={index}
                        label={item}
                        size="small"
                        variant="outlined"
                        icon={<span>{type === 'user' ? '👤' : '🏢'}</span>}
                    />
                ))}
            </Box>
        );
    }

    return (<Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>{displayValue}</Typography>)
}

export default ViewField;
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { AuthConfigType } from '../../../services/auth';

interface TypeSelectDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (type: AuthConfigType) => void;
}

const TYPE_OPTIONS: { type: AuthConfigType; labelKey: string; labelZh: string }[] = [
  { type: 'wecom', labelKey: 'setting.authentication.typeWecom', labelZh: '企业微信' },
  { type: 'microsoft_oidc', labelKey: 'setting.authentication.typeMicrosoftOidc', labelZh: 'Microsoft OIDC' },
];

const TypeSelectDialog: React.FC<TypeSelectDialogProps> = ({ open, onClose, onSelect }) => {
  const { t } = useTranslation();

  const handleSelect = (type: AuthConfigType) => {
    onSelect(type);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t('setting.authentication.selectType')}</DialogTitle>
      <DialogContent>
        <List>
          {TYPE_OPTIONS.map((opt) => (
            <ListItemButton key={opt.type} onClick={() => handleSelect(opt.type)}>
              <ListItemText
                primary={t(opt.labelKey) !== opt.labelKey ? t(opt.labelKey) : opt.labelZh}
              />
            </ListItemButton>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default TypeSelectDialog;

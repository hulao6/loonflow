import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import {
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSnackbar from '../../../hooks/useSnackbar';
import type { AuthConfigType } from '../../../services/auth';
import { AuthConfigListItem, deleteAuthConfig, getAuthConfigList } from '../../../services/auth';
import AuthConfigDialog from './AuthConfigDialog';
import TypeSelectDialog from './TypeSelectDialog';

const AuthenticationList: React.FC = () => {
  const [configs, setConfigs] = useState<AuthConfigListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchValue] = useState('');
  const [typeSelectOpen, setTypeSelectOpen] = useState(false);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [formType, setFormType] = useState<AuthConfigType | null>(null);
  const [editingConfig, setEditingConfig] = useState<{ id: string; type: AuthConfigType } | null>(null);
  const { showMessage } = useSnackbar();
  const { t } = useTranslation();

  const loadConfigs = useCallback(async () => {
    try {
      const response = await getAuthConfigList(searchValue, page + 1, rowsPerPage);
      if (response.code === 0) {
        setConfigs(response.data.authConfigList);
        setTotal(response.data.paginatorInfo.total);
      } else {
        showMessage((response as any).msg || t('common.loadFailed'), 'error');
      }
    } catch (error: any) {
      showMessage(error.message || t('common.loadFailed'), 'error');
    }
  }, [searchValue, page, rowsPerPage, showMessage, t]);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  const handleAdd = () => {
    setEditingConfig(null);
    setFormType(null);
    setTypeSelectOpen(true);
  };

  const handleTypeSelected = (type: AuthConfigType) => {
    setFormType(type);
    setFormDialogOpen(true);
  };

  const handleEdit = (config: AuthConfigListItem) => {
    setEditingConfig({ id: config.id, type: config.type });
    setFormType(config.type);
    setFormDialogOpen(true);
  };

  const handleDelete = async (configId: string) => {
    if (!window.confirm(t('setting.authentication.confirmDelete'))) return;
    try {
      const response = await deleteAuthConfig(configId);
      if (response.code === 0) {
        showMessage(t('common.deleteSuccess'), 'success');
        loadConfigs();
      } else {
        showMessage((response as any).msg || t('common.deleteFailed'), 'error');
      }
    } catch (error: any) {
      showMessage(error.message || t('common.deleteFailed'), 'error');
    }
  };

  const handleFormDialogClose = (shouldRefresh: boolean) => {
    setFormDialogOpen(false);
    setFormType(null);
    setEditingConfig(null);
    if (shouldRefresh) loadConfigs();
  };


  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5">{t('setting.authentication.title')}</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
          {t('setting.authentication.addAuthentication')}
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t('setting.authentication.columnType')}</TableCell>
              <TableCell>{t('setting.authentication.columnStatus')}</TableCell>
              <TableCell>{t('setting.authentication.columnCreatedAt')}</TableCell>
              <TableCell align="right">{t('common.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {configs.map((config) => (
              <TableRow key={config.id}>
                <TableCell>
                  {t(`setting.authentication.type.${config.type}`)}
                </TableCell>
                <TableCell>
                  <Chip
                    label={config.isEnabled ? t('setting.authentication.statusEnabled') : t('setting.authentication.statusDisabled')}
                    color={config.isEnabled ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>{config.createdAt}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => handleEdit(config)} color="primary">
                    <EditIcon />
                  </IconButton>
                  <IconButton size="small" onClick={() => handleDelete(config.id)} color="error">
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          labelRowsPerPage={t('common.rowsPerPage')}
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}`}
        />
      </TableContainer>

      <TypeSelectDialog
        open={typeSelectOpen}
        onClose={() => setTypeSelectOpen(false)}
        onSelect={handleTypeSelected}
      />

      <AuthConfigDialog
        open={formDialogOpen}
        type={formType}
        config={editingConfig}
        onClose={handleFormDialogClose}
      />
    </Box>
  );
};

export default AuthenticationList;

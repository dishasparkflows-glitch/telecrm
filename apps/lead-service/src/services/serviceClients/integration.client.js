const axios = require('axios');
const { env } = require('@sparkcrm/shared-config');
const { ApiError } = require('@sparkcrm/shared-utils');

const INTEGRATION_SERVICE = env.SERVICES.INTEGRATION || 'http://localhost:8013';

const apiClient = axios.create({
    baseURL: `${INTEGRATION_SERVICE}/internal`,
    headers: {
        'x-internal-service-secret': env.INTERNAL_SERVICE_SECRET
    }
});

const getConnection = async (tenantId, ownerId, provider, integrationType) => {
    try {
        const response = await apiClient.post('/connections/resolve', {
            tenantId,
            ownerId,
            provider,
            integrationType
        });
        return response.data.data;
    } catch (error) {
        if (error.response && error.response.status === 404) {
            return null; // No connection found
        }
        throw new ApiError(error.response?.status || 500, error.response?.data?.message || 'Failed to resolve connection');
    }
};

const googleSheetsApi = {
    listSpreadsheets: async (tenantId, connectionId) => {
        try {
            const res = await apiClient.get(`/google/sheets/list/${connectionId}`, { params: { tenantId } });
            return res.data.data;
        } catch (error) {
            throw new ApiError(error.response?.status || 500, error.response?.data?.message || 'Failed to list spreadsheets');
        }
    },
    listWorksheets: async (tenantId, connectionId, spreadsheetId) => {
        try {
            const res = await apiClient.get(`/google/sheets/${connectionId}/${spreadsheetId}/worksheets`, { params: { tenantId } });
            return res.data.data;
        } catch (error) {
            throw new ApiError(error.response?.status || 500, error.response?.data?.message || 'Failed to list worksheets');
        }
    },
    previewSheet: async (tenantId, connectionId, spreadsheetId, worksheetName) => {
        try {
            const res = await apiClient.post(`/google/sheets/preview`, { tenantId, connectionId, spreadsheetId, worksheetName });
            return res.data.data;
        } catch (error) {
            throw new ApiError(error.response?.status || 500, error.response?.data?.message || 'Failed to preview sheet');
        }
    },
    appendRows: async (tenantId, connectionId, spreadsheetId, worksheetName, values) => {
        try {
            const res = await apiClient.post(`/google/sheets/append`, { tenantId, connectionId, spreadsheetId, worksheetName, values });
            return res.data;
        } catch (error) {
            throw new ApiError(error.response?.status || 500, error.response?.data?.message || 'Failed to append rows');
        }
    }
};

const googleFormsApi = {
    listForms: async (tenantId, connectionId) => {
        try {
            const res = await apiClient.get(`/google/forms/list/${connectionId}`, { params: { tenantId } });
            return res.data.data;
        } catch (error) {
            throw new ApiError(error.response?.status || 500, error.response?.data?.message || 'Failed to list forms');
        }
    },
    getFields: async (tenantId, connectionId, formId) => {
        try {
            const res = await apiClient.get(`/google/forms/${connectionId}/${formId}/fields`, { params: { tenantId } });
            return res.data.data;
        } catch (error) {
            throw new ApiError(error.response?.status || 500, error.response?.data?.message || 'Failed to get form fields');
        }
    },
    watchForm: async (tenantId, connectionId, formId) => {
        try {
            const res = await apiClient.post(`/google/forms/watch`, { tenantId, connectionId, formId });
            return res.data.data;
        } catch (error) {
            throw new ApiError(error.response?.status || 500, error.response?.data?.message || 'Failed to watch form');
        }
    }
};

module.exports = {
    apiClient,
    getConnection,
    googleSheetsApi,
    googleFormsApi,
};

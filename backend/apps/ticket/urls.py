from django.urls import path
from apps.ticket.views import (
    TicketListView,
    TicketDetailFormView,
    TicketDetailActionsView,
    TicketHandleView,
    TicketFlowHistoryView,
    TicketCurrentNodeInfosView,
    TicketDetailAdminActionsView,
    TicketMockExternalAssigneeView,
    TicketMockExternalDataSourceView,
    TicketDraftFileUploadView,
    TicketDraftFileDownloadView,
    TicketFileUploadView,
    TicketFileDownloadView,
)

urlpatterns = [
    path('', TicketListView.as_view()),
    path('/draft/files', TicketDraftFileUploadView.as_view()),
    path('/<str:tenant_id>/draft/files/<str:safe_name>', TicketDraftFileDownloadView.as_view()),
    path('/<str:ticket_id>/ticket_detail_form', TicketDetailFormView.as_view()),
    path('/<str:ticket_id>/ticket_detail_actions', TicketDetailActionsView.as_view()),
    path('/<str:ticket_id>/ticket_detail_admin_actions', TicketDetailAdminActionsView.as_view()),
    path('/<str:ticket_id>/handle', TicketHandleView.as_view()),
    path('/<str:ticket_id>/ticket_flow_history', TicketFlowHistoryView.as_view()),
    path('/<str:ticket_id>/current_node_infos', TicketCurrentNodeInfosView.as_view()),
    path('/<str:ticket_id>/files', TicketFileUploadView.as_view()),
    path('/<str:tenant_id>/<str:ticket_id>/files/<str:safe_name>', TicketFileDownloadView.as_view()),
    path('/mock_external_assignee', TicketMockExternalAssigneeView.as_view()),
    path('/mock_external_data_source', TicketMockExternalDataSourceView.as_view()),
]

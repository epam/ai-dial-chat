import {
  ScheduledTaskCreateForm,
  ScheduledTaskDetailView,
  ScheduledTaskPresentationStatus,
  ScheduledTaskDeleteConfirmation,
  ScheduledTasks,
  ScheduledTasksSortKey,
} from '@epam/ai-dial-scheduled-tasks';
import '@epam/ai-dial-scheduled-tasks/styles.css';
import {
  DeploymentSelectorField,
  type DeploymentSelectorDisplayRecord,
} from '@epam/ai-dial-catalog';
import '@epam/ai-dial-catalog/styles.css';
import './styles.css';
import { createRoot } from 'react-dom/client';
import { useState } from 'react';

const Fixture = () => {
  const [sortKey, setSortKey] = useState(ScheduledTasksSortKey.FirstToRun);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deploymentId, setDeploymentId] = useState<string | null>('model-a');
  const records: DeploymentSelectorDisplayRecord[] = [
    { id: 'model-a', label: 'Model A' },
    { id: 'model-b', label: 'Model B with a deliberately long label' },
  ];

  return (
    <main className="fixture-shell">
      <button type="button" onClick={() => setDeleteOpen(true)}>
        Open delete confirmation
      </button>
      <ScheduledTasks
        labels={{
          title: 'Tasks',
          subtitle: 'Packed public API',
          createButtonLabel: 'Create',
          searchPlaceholder: 'Search',
          searchAriaLabel: 'Search tasks',
          clearSearchLabel: 'Clear search',
          sortLabel: 'Sort',
          sortOptions: [
            { value: ScheduledTasksSortKey.FirstToRun, label: 'First' },
            { value: ScheduledTasksSortKey.Newest, label: 'Newest' },
          ],
          emptyStateLabel: 'None',
          noResultsLabel: 'No results',
          errorLabel: 'Error',
          retryLabel: 'Retry',
          cardLabels: { completedBadgeLabel: 'Completed' },
        }}
        onCreateClick={() => undefined}
        searchQuery=""
        onSearchQueryChange={() => undefined}
        sortKey={sortKey}
        onSortChange={setSortKey}
        items={[
          {
            id: 'fixture',
            displayName: 'Packed task',
            scheduleLabel: 'Daily',
            presentationStatus: ScheduledTaskPresentationStatus.Completed,
          },
        ]}
      />
      <section aria-label="Scheduled task form">
        <ScheduledTaskCreateForm
          labels={{
            pageTitle: 'Create task',
            backButtonLabel: 'Back',
            cancelButtonLabel: 'Cancel',
            createButtonLabel: 'Create',
            submittingLabel: 'Creating',
            detailsSectionTitle: 'Details',
            detailsSectionSubtitle: 'Configure a packed task',
            configurationSectionTitle: 'Configuration',
            configurationSectionSubtitle: 'Packed public editor',
            displayNameLabel: 'Name',
            displayNameRequired: 'Name is required',
            descriptionLabel: 'Description',
            modelOrAgentLabel: 'Model',
            repeatLabel: 'Repeat',
            repeatOptions: [{ key: 'daily', label: 'Daily' }],
            timeLabel: 'Time',
            timeInvalidLabel: 'Invalid time',
            instructionsLabel: 'Instructions',
            instructionsPlaceholder: 'Write instructions',
            runAtLabel: 'Run at',
            dayOfWeekLabel: 'Day of week',
            dayOfMonthLabel: 'Day of month',
            minuteLabel: 'Minute',
            startDateLabel: 'Start date',
            startDatePlaceholder: 'Choose a start date',
            endDateLabel: 'End date',
            endDatePlaceholder: 'Choose an end date',
          }}
          values={{
            displayName: 'Packed task',
            description: '',
            modelId: deploymentId ?? '',
            prompt: 'Prompt',
            repeat: 'daily',
            time: '09:00',
            timezone: 'UTC',
          }}
          errors={{}}
          modelLabelId="fixture-model-label"
          modelSelector={
            <DeploymentSelectorField
              selectedId={deploymentId}
              records={records}
              placeholder="Choose a model"
              labels={{
                searchPlaceholder: 'Search models',
                searchAriaLabel: 'Search models',
                emptyLabel: 'No models',
                errorLabel: 'Could not load models',
                browseLabel: 'Browse',
              }}
              onSelect={setDeploymentId}
            />
          }
          onFieldChange={() => undefined}
          onBack={() => undefined}
          onCancel={() => undefined}
          onSubmit={() => undefined}
        />
      </section>
      <section className="fixture-detail" aria-label="Scheduled task detail">
        <ScheduledTaskDetailView
          labels={{
            backAriaLabel: 'Back',
            activeStatusLabel: 'Active',
            deleteButtonLabel: 'Delete',
            editButtonLabel: 'Edit',
            deletedStateLabel: 'Deleted',
            detailsTitle: 'Details',
            configurationTitle: 'Configuration',
            historyTitle: 'History',
            descriptionLabel: 'Description',
            modelLabel: 'Model',
            repeatsLabel: 'Repeats',
            activeWindowLabel: 'Active window',
            instructionsLabel: 'Instructions',
            historyEmptyLabel: 'No runs',
            historyErrorLabel: 'Could not load runs',
            historyRetryLabel: 'Retry',
            historyLoadingMoreLabel: 'Loading more',
            historyShowMoreLabel: 'Show more',
            runStatusLabels: {
              success: 'Completed',
              error: 'Failed',
              inProgress: 'In progress',
              missed: 'Missed',
            },
            unreadIndicatorLabel: 'Unread',
            errorLabel: 'Could not load task',
            retryLabel: 'Retry',
          }}
          onBack={() => undefined}
          displayName="Packed task"
          description="A packed detail surface"
          modelLabel="Model A"
          repeatsLabel="Daily"
          instructionsMarkdown="Packed instructions"
          runs={[]}
        />
      </section>
      <ScheduledTaskDeleteConfirmation
        open={deleteOpen}
        taskName="Packed task"
        title="Delete task"
        body="This action cannot be undone."
        cancelLabel="Cancel"
        confirmLabel="Delete"
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => setDeleteOpen(false)}
      />
    </main>
  );
};

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<Fixture />);
}

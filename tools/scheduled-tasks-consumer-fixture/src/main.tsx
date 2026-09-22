import { BuilderFormContainer } from '@epam/ai-dial-builder-form';
import {
  DeploymentSelectorField,
  type DeploymentSelectorDisplayRecord,
} from '@epam/ai-dial-catalog';
import {
  describeScheduledTaskTrigger,
  prepareScheduledTaskCreateBody,
} from '@epam/ai-dial-chat-hooks/scheduled-tasks';
import {
  ScheduledTaskCreateForm,
  ScheduledTaskRepeat,
  ScheduledTaskCardGrid,
  ScheduledTaskDetailView,
  ScheduledTaskPresentationStatus,
  ScheduledTaskDeleteConfirmation,
  ScheduledTasks,
  ScheduledTasksSortKey,
} from '@epam/ai-dial-scheduled-tasks';
import { validateScheduledTaskFormValues } from '@epam/ai-dial-scheduled-tasks/validation';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@epam/ai-dial-scheduled-tasks/styles.css';
import '@epam/ai-dial-catalog/styles.css';
import '@epam/ai-dial-ui-kit/styles.css';
import './styles.css';

const values = {
  displayName: 'Packed task',
  modelId: 'model-a',
  prompt: '',
  repeat: ScheduledTaskRepeat.Daily,
  time: '09:00',
};
const descriptor = describeScheduledTaskTrigger({
  cron: { fields: { hour: '9', minute: '0' } },
});
const validation = validateScheduledTaskFormValues(values, { now: new Date() });
const prepared = prepareScheduledTaskCreateBody(
  { ...values, prompt: 'Run task' },
  { now: new Date() },
);
if (!validation.prompt || !prepared.ok || descriptor.time !== '09:00')
  throw new Error('Packed scheduler contracts failed');

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
      <div className="header">Unrelated host header</div>
      <section aria-label="Responsive cards">
        <ScheduledTaskCardGrid
          items={Array.from({ length: 5 }, (_, i) => ({
            id: String(i),
            displayName: 'Card ' + i,
            scheduleLabel: 'Daily',
          }))}
          trailingSkeletonCount={1}
          layout={{
            minCardWidth: '240px',
            maxWidth: '100%',
            cardHeight: '190px',
            gap: '16px',
          }}
        />
      </section>
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
      <section aria-label="Default builder">
        <BuilderFormContainer
          labels={{
            title: 'Generic editor',
            backButtonLabel: 'Back',
            cancelButtonLabel: 'Cancel',
            submitButtonLabel: 'Save',
          }}
          left={<div data-testid="generic-left">Left column</div>}
          onBack={() => undefined}
          onCancel={() => undefined}
          onSubmit={() => undefined}
        >
          <div data-testid="generic-main">Main column</div>
        </BuilderFormContainer>
      </section>
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
            timeInvalidLabel: 'Invalid time',
            descriptionLabel: 'Description',
            modelOrAgentLabel: 'Model',
            repeatLabel: 'Repeat',
            repeatOptions: [{ key: ScheduledTaskRepeat.Daily, label: 'Daily' }],
            timeLabel: 'Time',
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
            prompt: '',
            repeat: ScheduledTaskRepeat.Daily,
            time: '09:00',
          }}
          styles={{ layout: { detailsWidth: '280px', columnGap: '24px' } }}
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
              onBrowse={() => setDeleteOpen(true)}
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
          renderInstructions={(text) => <p>{text}</p>}
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

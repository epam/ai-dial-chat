import { useEffect, useMemo, useRef } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';

import { PromptsActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SkillValidationStatus } from '@/src/store/prompts/prompts.types';
import { ApplicationSelectors, PromptsSelectors } from '@/src/store/selectors';

import { QuickApp2Form } from '@/src/components/AppsEditor/form';

import isEqual from 'lodash-es/isEqual';

/**
 * Mirrors the Agent Skills validation state into the form.
 *
 * Skills are validated by `autoValidateSkillEpic`, which reacts to `uploadPrompt`.
 * `AgentSkillsItem` triggers that upload, but it is only mounted while the Agent Skills
 * section is expanded, so a collapsed section would leave invalid skills unreported.
 * This hook lives in the always-mounted form and uploads the selected skills itself.
 *
 * The invalid ids are written into the `invalidAgentSkills` field, which `QuickApp2Schema`
 * refines into an `agentSkills` issue - that is what makes the form invalid and puts the
 * "App settings" tab into the error state.
 */
export const useAgentSkillsValidation = () => {
  const dispatch = useAppDispatch();

  const { control, getValues, setValue, trigger } =
    useFormContext<QuickApp2Form>();

  const agentSkills = useWatch({ control, name: 'agentSkills' });

  // `autoValidateSkillEpic` needs the application to exist, otherwise it skips validation
  const appId = useAppSelector(
    ApplicationSelectors.selectApplicationDetail,
  )?.id;
  const skillValidationMap = useAppSelector(
    PromptsSelectors.selectSkillValidationMap,
  );

  // skills already requested by this hook - `uploadPrompt` always refetches, so without
  // this the effect would re-dispatch on every validation map update
  const requestedSkillsRef = useRef(new Set<string>());

  useEffect(() => {
    if (!agentSkills?.length || !appId) {
      return;
    }

    // forget deselected skills so that re-adding one validates it again
    requestedSkillsRef.current = new Set(
      [...requestedSkillsRef.current].filter((promptId) =>
        agentSkills.includes(promptId),
      ),
    );

    agentSkills.forEach((promptId) => {
      // `uploadPrompt` fetches by id, so the prompt does not have to be in the store -
      // and on failure `uploadPromptEpic` still validates the skill, which is what
      // surfaces a missing or inaccessible one as invalid
      if (
        skillValidationMap[promptId] === undefined &&
        !requestedSkillsRef.current.has(promptId)
      ) {
        requestedSkillsRef.current.add(promptId);
        dispatch(PromptsActions.uploadPrompt({ promptId }));
      }
    });
  }, [agentSkills, appId, dispatch, skillValidationMap]);

  const invalidSkills = useMemo(
    () =>
      (agentSkills ?? []).filter(
        (promptId) =>
          skillValidationMap[promptId]?.status ===
          SkillValidationStatus.Invalid,
      ),
    [agentSkills, skillValidationMap],
  );

  useEffect(() => {
    if (isEqual(getValues('invalidAgentSkills'), invalidSkills)) {
      return;
    }

    setValue('invalidAgentSkills', invalidSkills, { shouldDirty: false });
    // `shouldValidate` would only validate `invalidAgentSkills` itself, and the schema
    // reports the issue on `agentSkills` - such an error is dropped as unrelated to the
    // validated field, so the whole form has to be re-validated instead
    void trigger();
  }, [getValues, invalidSkills, setValue, trigger]);
};

import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import { ExpectedMessages } from '@/src/testData';
import { AgentDetailsModal } from '@/src/ui/webElements';

// Import the web element

export class AgentDetailsModalAssertion extends BaseAssertion {
  readonly agentDetailsModal: AgentDetailsModal;

  constructor(agentDetailsModal: AgentDetailsModal) {
    super();
    this.agentDetailsModal = agentDetailsModal;
  }

  /**
   * Normalizes whitespace in a string, replacing multiple newlines with single ones
   * and trimming lines.
   * @param text The input string.
   * @returns The normalized string.
   */
  private normalizeDescriptionWhitespace(
    text: string | null | undefined,
  ): string {
    if (!text) {
      return '';
    }
    return text
      .replace(/\r\n/g, '\n') // Normalize Windows line endings
      .replace(/\n{2,}/g, '\n') // Replace multiple newlines with one
      .split('\n') // Split into lines
      .map((line) => line.trim()) // Trim each line
      .join('\n') // Join back with single newlines
      .trim(); // Trim entire string
  }

  /**
   * Asserts the description text within the agent details modal, normalizing whitespace.
   * @param expectedDescription The expected description text.
   */
  public async assertDescription(expectedDescription: string) {
    const actualDescriptionRaw =
      await this.agentDetailsModal.applicationDescription.getElementContent();

    const actualNormalized =
      this.normalizeDescriptionWhitespace(actualDescriptionRaw);
    const expectedNormalized =
      this.normalizeDescriptionWhitespace(expectedDescription);

    this.assertValue(
      actualNormalized,
      expectedNormalized,
      ExpectedMessages.agentDescriptionIsValid,
    );
  }

  /**
   * Asserts the agent name displayed in the modal.
   * @param expectedName The expected agent name.
   */
  public async assertApplicationName(expectedName: string) {
    await this.assertElementText(
      this.agentDetailsModal.agentName,
      expectedName,
      ExpectedMessages.agentNameIsValid,
    );
  }

  /**
   * Asserts the agent version displayed in the modal.
   * @param expectedVersion The expected agent version.
   */
  public async assertApplicationVersion(expectedVersion: string) {
    await this.assertElementText(
      this.agentDetailsModal.agentVersion,
      expectedVersion,
      ExpectedMessages.chatInfoVersionIsValid,
    );
  }
}

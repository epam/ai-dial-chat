import { BaseAssertion } from '@/src/assertions/base/baseAssertion';
import { ExpectedMessages } from '@/src/testData';
import { AgentDetailsModal } from '@/src/ui/webElements';

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
  private normalizeDescriptionWhitespaces(
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

  public async assertDescription(expectedDescription: string) {
    const actualDescriptionRaw =
      await this.agentDetailsModal.applicationDescription.getElementContent();

    const actualNormalized =
      this.normalizeDescriptionWhitespaces(actualDescriptionRaw);
    const expectedNormalized =
      this.normalizeDescriptionWhitespaces(expectedDescription);

    this.assertValue(
      actualNormalized,
      expectedNormalized,
      ExpectedMessages.agentDescriptionIsValid,
    );
  }

  public async assertApplicationName(expectedName: string) {
    await this.assertElementText(
      this.agentDetailsModal.agentName,
      expectedName,
      ExpectedMessages.agentNameIsValid,
    );
  }

  public async assertApplicationVersion(expectedVersion: string) {
    await this.assertElementText(
      this.agentDetailsModal.agentVersion,
      expectedVersion,
      ExpectedMessages.chatInfoVersionIsValid,
    );
  }
}

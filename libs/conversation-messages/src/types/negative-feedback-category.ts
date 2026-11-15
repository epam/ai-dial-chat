/** Reason a user picks when disliking a message; the value is the text sent in the rating comment. */
export enum NegativeFeedbackCategory {
  /** Something in the interface did not work. */
  UiBug = 'UI bug',
  /** The model refused a request it should have answered. */
  OveractiveRefusal = 'Overactive refusal',
  /** The answer stopped short or missed part of the request. */
  IncompleteResponse = 'Incomplete response',
  /** The model answered without reasoning when it should have. */
  ShouldHaveTriggeredThinking = 'Should have triggered thinking',
  /** The model answered from memory when it should have searched the web. */
  ShouldHaveSearchedTheWeb = 'Should have searched the web',
}

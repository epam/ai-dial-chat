interface Props {
  modelId: string;
  size: number;
  inverted?: boolean;
  animate?: boolean;
  modelName?: string;
}

export const ModelIcon = ({
  modelId,
  size,
  inverted,
  animate,
  modelName,
}: Props) => {
  return (
    <>
      <span
        style={{
          width: size,
          height: size,
          backgroundImage: `var(--${CSS.escape(
            modelId,
          )}-model, var(--DEFAULT-model, url(/images/default-model.svg)))`,
        }}
        className={`block bg-contain bg-no-repeat ${inverted ? 'invert' : ''} ${
          animate ? 'animate-bounce' : ''
        }`}
        role="img"
        aria-label={`${modelId} icon`}
        title={modelName}
      ></span>
    </>
  );
};

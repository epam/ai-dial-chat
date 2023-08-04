import { SVGProps } from 'react';

interface SVGIconProps extends SVGProps<SVGElement> {
  SVGElement: any;
}
const SVGIcon = (props: SVGIconProps) => {
  return <props.SVGElement {...props} />;
};

export default SVGIcon;

import { render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FolderPath } from '../FolderPath';

interface MockPathItem {
  label: ReactNode;
  disabled?: boolean;
  iconBefore?: ReactNode;
}

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  DialIcon: ({ icon, className }: { icon: ReactNode; className?: string }) => (
    <span className={className}>{icon}</span>
  ),
  DialBreadcrumb: ({
    pathItems,
    labelClassName,
    className,
  }: {
    pathItems: MockPathItem[];
    labelClassName?: string;
    className?: string;
  }) => (
    <nav className={className} aria-label="breadcrumb">
      {pathItems.map((item, i) => (
        <span key={i} className={labelClassName}>
          {item.iconBefore}
          {item.label}
        </span>
      ))}
    </nav>
  ),
}));

vi.mock('@tabler/icons-react', () => ({
  IconFolder: () => <svg data-icon="folder" />,
  IconChevronRight: () => <svg data-icon="chevron" />,
}));

describe('FolderPath', () => {
  it('renders every segment in order', () => {
    render(<FolderPath segments={['Public', 'Project folder', 'Sub']} />);

    expect(screen.getByText('Public')).toBeTruthy();
    expect(screen.getByText('Project folder')).toBeTruthy();
    expect(screen.getByText('Sub')).toBeTruthy();
  });

  it('wraps the last segment with the leaf className', () => {
    render(
      <FolderPath
        segments={['Public', 'Project folder']}
        leafClassName="leaf-class"
      />,
    );

    expect(screen.getByText('Project folder').className).toBe('leaf-class');
  });

  it('shows a folder icon only before the first segment', () => {
    render(<FolderPath segments={['Public', 'Project folder']} />);

    expect(document.querySelectorAll('[data-icon="folder"]')).toHaveLength(1);
  });

  it('forwards a caller className to the breadcrumb nav', () => {
    render(<FolderPath segments={['Public']} className="w-full" />);

    expect(screen.getByRole('navigation').className).toBe('w-full');
  });
});

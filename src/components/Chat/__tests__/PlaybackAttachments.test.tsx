import { render, screen } from '@testing-library/react';
import { PlaybackAttachments } from '../Playback/PlaybackAttachments';
import {describe, it, expect}from 'vitest';

describe('<PlaybackAttachments />', () => {

  const fakeData = [
    { title: 'Test 1', index: '1' },
    { title: 'Test 2', index: 2 },
    { title: 'Test 3', index: '3' },
  ];

  it('renders all elements with correct titles', () => {
    render(<PlaybackAttachments attachments={fakeData} />);

    fakeData.forEach(item => {
      const element = screen.getByText(item.title);
      expect(element).toBeInTheDocument();
    });
  });

  it('do not renders any of elements with title', () => {
    render(<PlaybackAttachments attachments={[]} />);

    fakeData.forEach(item => {
      const element = screen.queryByText(item.title);
      expect(element).not.toBeInTheDocument();
    });
  });

});
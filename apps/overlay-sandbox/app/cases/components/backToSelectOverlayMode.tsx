import Link from 'next/link';

export function BackToButton() {
  return (
    <Link
      href="/"
      className="w-[300px] rounded bg-gray-200 p-2 text-center hover:bg-gray-400"
    >
      Back to select Overlay mode
    </Link>
  );
}

import Link from 'next/link';

export default async function Index() {
  return (
    <div>
      <Link href={'/cases/overlay'}>Overlay</Link>
      <Link href={'/cases/overlay-manager'}>Overlay Manager</Link>
    </div>
  );
}

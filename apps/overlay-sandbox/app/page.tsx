import Link from 'next/link';

export default async function Index() {
  return (
    <div>
      <Link href={'/cases/overlay/model-id-set-sandbox'}>Overlay</Link>
      <Link href={'/cases/overlay-manager'}>Overlay Manager</Link>
    </div>
  );
}

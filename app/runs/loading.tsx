import { Shell } from '@/app/_components/Shell';
import { Skel, SkeletonScreen } from '@/app/_components/Skeleton';

export default function RunsLoading() {
  return (
    <Shell active="runs" recent={null}>
      <SkeletonScreen label="Loading runs">
        <div className="pagehead">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Skel w={90} h={26} />
            <Skel w={320} h={12} />
          </div>
          <Skel w={140} h={40} r={10} />
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Skel w={32} h={32} r={16} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Skel w="30%" h={13} />
                <Skel w="50%" h={11} />
              </div>
              <Skel w={72} h={22} r={11} />
              <Skel w={90} h={12} />
            </div>
          ))}
        </div>
      </SkeletonScreen>
    </Shell>
  );
}

import { Shell } from '@/app/_components/Shell';
import { Skel, SkeletonScreen } from '@/app/_components/Skeleton';

// Mirrors the Results layout: header, KPI cards, tabs, then reel rows.
export default function RunLoading() {
  return (
    <Shell active="runs" recent={null}>
      <SkeletonScreen label="Loading run results">
        <div className="pagehead">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
            <Skel w={160} h={12} />
            <Skel w={280} h={26} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Skel w={96} h={40} r={10} />
            <Skel w={200} h={40} r={10} />
          </div>
        </div>
        <div className="kpis">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="kpi" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Skel w="60%" h={11} />
              <Skel w="45%" h={26} />
              <Skel w="70%" h={11} />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 18, margin: '20px 0 14px' }}>
          {[90, 70, 110, 130].map((w, i) => (
            <Skel key={i} w={w} h={16} />
          ))}
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <Skel w={44} h={56} r={8} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Skel w="40%" h={13} />
                <Skel w="75%" h={11} />
              </div>
              <Skel w={64} h={13} />
              <Skel w={48} h={13} />
            </div>
          ))}
        </div>
      </SkeletonScreen>
    </Shell>
  );
}

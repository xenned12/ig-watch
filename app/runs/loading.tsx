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
        {/* Same table, headers and widths as RunsTable, with placeholder cells. */}
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr><th>Client</th><th>Niche</th><th>Competitors</th><th>Posts</th><th>Status</th><th>Date</th></tr>
            </thead>
            <tbody>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <tr key={i}>
                  <td><Skel w={[150, 110, 130][i % 3]} h={14} /></td>
                  <td><Skel w={[30, 90, 60][i % 3]} h={14} /></td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <Skel w={150} h={11} />
                      <Skel w={110} h={11} />
                    </div>
                  </td>
                  <td><Skel w={22} h={14} /></td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <Skel w={64} h={22} r={11} />
                      {i % 3 === 2 && <Skel w={170} h={11} />}
                    </div>
                  </td>
                  <td><Skel w={80} h={12} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SkeletonScreen>
    </Shell>
  );
}

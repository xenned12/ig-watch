import { Shell } from '@/app/_components/Shell';
import { Skel, SkeletonScreen } from '@/app/_components/Skeleton';

// Mirrors Results + OverviewTab with the same layout classes (pagehead, kpis,
// tabs, two, card, cmpbar, list-row, pat, rec), so spacing and card count match
// the loaded page: 4 KPI cards, 3 tabs, 2 side-by-side cards, patterns, recommendations.

/** A box the height of the real text line, with the placeholder bar centred in it. */
function Line({ h, children, style }: { h: number; children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ height: h, display: 'flex', alignItems: 'center', ...style }}>{children}</div>;
}

function CardHead({ title, note }: { title: number; note: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8, minHeight: 26 }}>
      <Skel w={title} h={18} />
      <Skel w={note} h={11} />
    </div>
  );
}

export default function RunLoading() {
  return (
    <Shell active="runs" recent={null}>
      <SkeletonScreen label="Loading run results">
        <div className="pagehead">
          <div>
            <Line h={18}><Skel w={260} h={12} /></Line>
            <Line h={33}><Skel w={330} h={24} /></Line>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Skel w={99} h={40} r={10} />
            <Skel w={213} h={40} r={10} />
          </div>
        </div>

        <div className="kpis">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="kpi">
              <Line h={18}><Skel w="65%" h={12} /></Line>
              <Line h={33} style={{ marginTop: 4 }}><Skel w="45%" h={24} /></Line>
              <Line h={18} style={{ marginTop: 2 }}><Skel w="55%" h={12} /></Line>
            </div>
          ))}
        </div>

        <div className="tabs" aria-hidden="true">
          {[83, 194, 213].map((w, i) => (
            <span key={i} style={{ padding: '16px 12px', width: w, boxSizing: 'border-box', height: 46 }}>
              <Skel h={14} />
            </span>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 4 }}>
          <div className="two">
            <section className="card">
              <CardHead title={190} note={90} />
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="cmpbar" style={{ minHeight: i === 0 ? 60 : 55 }}>
                  <span className="cmpbar-name"><Skel w={[110, 130, 160, 100][i]} h={12} /></span>
                  <Skel h={10} r={5} />
                  <Skel w={34} h={12} style={{ justifySelf: 'end' }} />
                </div>
              ))}
              <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
                <Skel w={77} h={12} />
                <Skel w={47} h={12} />
              </div>
            </section>
            <section className="card">
              <div style={{ marginBottom: 6, minHeight: 26, display: 'flex', alignItems: 'center' }}>
                <Skel w={200} h={18} />
              </div>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="list-row">
                  <div style={{ flex: 1 }}>
                    <Line h={21}><Skel w="90%" h={12} /></Line>
                    {i !== 4 && <Line h={21}><Skel w="60%" h={12} /></Line>}
                  </div>
                  <Skel w={60} h={24} r={12} />
                </div>
              ))}
            </section>
          </div>

          <section className="card">
            <CardHead title={230} note={260} />
            <div className="pat head" style={{ minHeight: 27 }}>
              <Skel w={60} h={11} />
              <Skel w={70} h={11} />
              <Skel w={40} h={11} />
            </div>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="pat" style={{ minHeight: 50 }}>
                <Skel w={[220, 180, 260, 200, 240, 170][i]} h={13} />
                <Skel h={8} r={4} />
                <Skel h={8} r={4} />
              </div>
            ))}
          </section>

          <section className="card">
            <CardHead title={150} note={250} />
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="rec" style={{ minHeight: 95 }}>
                <Skel w={22} h={22} r={11} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                  <Skel w="70%" h={14} />
                  <Skel w="90%" h={12} />
                  <Skel w="45%" h={12} />
                </div>
              </div>
            ))}
          </section>
        </div>
      </SkeletonScreen>
    </Shell>
  );
}

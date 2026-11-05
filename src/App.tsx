import { LangFab } from './i18n/LangFab.tsx';
import { PageHost } from './shell/PageHost.tsx';
import { SlideHandles } from './shell/SlideHandles.tsx';
import { WakeVideo } from './shell/WakeVideo.tsx';
import { NavTop } from './shell/navbar/NavTop.tsx';
import { RemarkPill } from './shell/remark/RemarkPill.tsx';
import { Toast } from './shell/toast/Toast.tsx';
import { Topbar } from './shell/topbar/Topbar.tsx';
import { UiEditor } from './shell/uiEdit/UiEditor.tsx';
import { useBoot } from './shell/useBoot.ts';

/**
 * The whole app: the same body children, in the same order, as the legacy
 * page once its scripts ran (top bar, nav bar, `#view`, bubble, wake video,
 * language button, slide handles, remark pill).
 * @returns The app chrome around the current screen.
 */
export function App() {
  useBoot();
  return (
    <>
      <Topbar />
      <NavTop />
      <main id="view">
        <PageHost />
      </main>
      <Toast />
      <WakeVideo />
      <LangFab />
      <SlideHandles />
      <RemarkPill />
      <UiEditor />
    </>
  );
}

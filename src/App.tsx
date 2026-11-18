import { SideRails } from './pages/tracker/SideRails.tsx';
import { PageHost } from './shell/PageHost.tsx';
import { SlideHandles } from './shell/SlideHandles.tsx';
import { WakeVideo } from './shell/WakeVideo.tsx';
import { NavTop } from './shell/navbar/NavTop.tsx';
import { RemarkPill } from './shell/remark/RemarkPill.tsx';
import { SearchButton } from './shell/search/SearchButton.tsx';
import { Toast } from './shell/toast/Toast.tsx';
import { Topbar } from './shell/topbar/Topbar.tsx';
import { useBoot } from './shell/useBoot.ts';

/**
 * The whole app: the same body children, in the same order, as the legacy
 * page once its scripts ran (top bar, nav bar, `#view`, bubble, wake video,
 * slide handles, remark pill); the language is chosen in the settings.
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
      <SlideHandles />
      <SearchButton />
      <SideRails />
      <RemarkPill />
    </>
  );
}

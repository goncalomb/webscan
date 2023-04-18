import React, { useCallback, useEffect, useState } from 'react';
import { useSANEContext } from '../SANEContext';

// copied from MIT license
const WARRANTY_DISCLAIMER =`
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`.replaceAll('\n', ' ').trim();

export default function Disclaimer() {
  const { lib, state, getDevices } = useSANEContext();
  const [ accepted, setAccepted ] = useState(sessionStorage.getItem('disclaimer-accepted') === '1');

  const onClick = useCallback(() => {
    if (accepted) {
      sessionStorage.removeItem('disclaimer-accepted');
    } else {
      sessionStorage.setItem('disclaimer-accepted', '1');
    }
    setAccepted(accepted => !accepted);
  }, [accepted, setAccepted]);

  useEffect(() => {
    if (lib && !state?.initialized && accepted) {
      getDevices();
    }
  }, [lib, state?.initialized, accepted, getDevices]);

  return accepted ? (
    <button onClick={onClick} disabled={state?.open}>Revoke/Review</button>
  ) : (
    <>
      <p>This is an experimental application. Behind the scenes it uses the well established <a href='http://www.sane-project.org/'>SANE project</a> (<a href='https://en.wikipedia.org/wiki/Scanner_Access_Now_Easy'>wiki</a>) to do the actual scanning. For MANY scanner models this project does NOT use official manufacturer software to control the scanner. If you see your device misbehaving, unplug it.</p>
      <pre style={{whiteSpace: 'pre-wrap'}}>{WARRANTY_DISCLAIMER}</pre>
      <button onClick={onClick} disabled={state?.open}>Accept</button>
    </>
  );
}

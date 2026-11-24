import { type ComponentRef, useEffect, useRef } from 'react';
import { Platform, Switch, type SwitchProps, View } from 'react-native';
import { webFocusTarget } from '../theme/web-focus-target';

export function SettingSwitch(props: SwitchProps) {
  const switchRef = useRef<ComponentRef<typeof Switch>>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !switchRef.current) return;

    // React Native Web forwards the ref to the checkbox, which handles Space itself.
    const input = switchRef.current as unknown as HTMLInputElement;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      if (!event.repeat) input.click();
    };
    input.addEventListener('keydown', onKeyDown);
    return () => input.removeEventListener('keydown', onKeyDown);
  }, []);

  if (Platform.OS !== 'web') {
    return <Switch {...props} />;
  }

  return (
    <View {...webFocusTarget('switch')}>
      <Switch {...props} ref={switchRef} />
    </View>
  );
}

import { useEffect, useRef } from 'react';
import { Platform, Pressable, Switch, SwitchProps, View } from 'react-native';
import { webFocusTarget } from '../theme/web-focus-target';

type SettingSwitchProps = SwitchProps;

function bindWebSwitchKeys(
  element: View | null,
  onToggle: () => void,
): (() => void) | undefined {
  if (Platform.OS !== 'web' || !element) {
    return undefined;
  }

  const node = element as unknown as HTMLElement;
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    onToggle();
  };

  node.addEventListener('keydown', onKeyDown);
  return () => node.removeEventListener('keydown', onKeyDown);
}

/** Profile-style switch with web keyboard toggle (Enter + Space). */
export function SettingSwitch({
  value,
  onValueChange,
  disabled,
  ...props
}: SettingSwitchProps) {
  const pressableRef = useRef<View>(null);

  const toggle = () => {
    if (disabled || value === undefined || !onValueChange) {
      return;
    }

    onValueChange(!value);
  };

  useEffect(() => {
    return bindWebSwitchKeys(pressableRef.current, () => {
      if (disabled || value === undefined || !onValueChange) {
        return;
      }

      onValueChange(!value);
    });
  }, [disabled, value, onValueChange]);

  return (
    <Pressable
      ref={pressableRef}
      onPress={toggle}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      {...webFocusTarget('switch')}
    >
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        {...props}
      />
    </Pressable>
  );
}

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Platform,
  Pressable,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { useTranslation } from '../i18n/language-context';
import { useAppStyles } from '../theme/styles';
import { useColors } from '../theme/theme-context';

type PasswordFieldProps = {
  label: string;
} & Pick<
  TextInputProps,
  | 'value'
  | 'onChangeText'
  | 'placeholder'
  | 'returnKeyType'
  | 'onSubmitEditing'
  | 'autoComplete'
  | 'textContentType'
>;

export function PasswordField({
  label,
  value,
  onChangeText,
  placeholder,
  returnKeyType,
  onSubmitEditing,
  autoComplete,
  textContentType,
}: PasswordFieldProps) {
  const styles = useAppStyles();
  const colors = useColors();
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.passwordFieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View
        style={[styles.passwordField, isFocused && styles.inputFocused]}
        {...(Platform.OS === 'web' ? { dataSet: { wwFieldGroup: 'true' } } : {})}
      >
        <TextInput
          style={styles.passwordInput}
          {...(Platform.OS === 'web' ? { dataSet: { wwFieldInput: 'true' } } : {})}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!isVisible}
          autoComplete={autoComplete}
          textContentType={textContentType}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          placeholderTextColor={colors.textSubtle}
        />
        <Pressable
          style={styles.passwordToggle}
          onPress={() => setIsVisible((current) => !current)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={isVisible ? t('auth.hidePassword') : t('auth.showPassword')}
        >
          <Ionicons
            name={isVisible ? 'eye-off-outline' : 'eye-outline'}
            size={22}
            color={colors.textMuted}
          />
        </Pressable>
      </View>
    </View>
  );
}

import { useState } from 'react';
import { Text, TextInput, TextInputProps, View } from 'react-native';
import { useTranslation } from '../i18n/language-context';
import { useAppStyles } from '../theme/styles';
import { useColors } from '../theme/theme-context';

type EmailFieldProps = Pick<
  TextInputProps,
  'value' | 'onChangeText' | 'returnKeyType' | 'onSubmitEditing' | 'onBlur'
> & {
  errorText?: string | null;
};

export function EmailField({
  value,
  onChangeText,
  returnKeyType = 'next',
  onSubmitEditing,
  onBlur,
  errorText,
}: EmailFieldProps) {
  const styles = useAppStyles();
  const colors = useColors();
  const { t } = useTranslation();
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.passwordFieldGroup}>
      <Text style={styles.fieldLabel}>{t('auth.email')}</Text>
      <TextInput
        style={[
          styles.input,
          isFocused && styles.inputFocused,
          errorText ? styles.dateButtonInvalid : null,
        ]}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setIsFocused(true)}
        onBlur={(event) => {
          setIsFocused(false);
          onBlur?.(event);
        }}
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        keyboardType="email-address"
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        placeholder={t('auth.emailPlaceholder')}
        placeholderTextColor={colors.textSubtle}
      />
      {errorText ? <Text style={styles.fieldErrorText}>{errorText}</Text> : null}
    </View>
  );
}

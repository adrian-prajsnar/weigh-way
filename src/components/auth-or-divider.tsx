import { Text, View } from 'react-native';
import { useTranslation } from '../i18n/language-context';
import { useAppStyles } from '../theme/styles';

export function AuthOrDivider() {
  const styles = useAppStyles();
  const { t } = useTranslation();

  return (
    <View style={styles.authOrDivider}>
      <View style={styles.authOrDividerLine} />
      <Text style={styles.authOrDividerText}>{t('auth.or')}</Text>
      <View style={styles.authOrDividerLine} />
    </View>
  );
}

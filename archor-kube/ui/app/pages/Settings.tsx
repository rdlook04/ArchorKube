import React, { useState } from "react";

import Borders from "@dynatrace/strato-design-tokens/borders";
import Colors from "@dynatrace/strato-design-tokens/colors";
import { Button } from "@dynatrace/strato-components/buttons";
import { Flex } from "@dynatrace/strato-components/layouts";
import { FormField, Label, Radio, RadioGroup, TextInput } from "@dynatrace/strato-components/forms";
import { showToast } from "@dynatrace/strato-components/notifications";
import {
  ExternalLink,
  Heading,
  List,
  Paragraph,
  Strong,
  Text,
} from "@dynatrace/strato-components/typography";

import { DEFAULT_BRIDGE_URL, getBridgeUrl, setBridgeUrl } from "../ai/ollamaBridge";
import type { DataMode } from "../ai/redact";
import { useAiSettings } from "../ai/settings";
import { useT } from "../i18n";
import type { Lang } from "../i18n";

const BRIDGE_README = "https://github.com/rdlook04/ArchorKube/tree/master/tools/ollama-bridge";

const Section = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      padding: 20,
      background: Colors.Background.Container.Neutral.Default,
      border: `1px solid ${Colors.Border.Neutral.Default}`,
      borderRadius: Borders.Radius.Container.Default,
    }}
  >
    <Flex flexDirection="column" gap={12}>
      {children}
    </Flex>
  </div>
);

const Hint = ({ children }: { children: React.ReactNode }) => (
  <Text textStyle="small" style={{ color: Colors.Text.Neutral.Subdued }}>
    {children}
  </Text>
);

export const Settings = () => {
  const { settings, loaded, save } = useAiSettings();
  const { t } = useT();
  const [bridgeUrl, setBridgeUrlDraft] = useState(getBridgeUrl);

  const persist = (next: typeof settings, failHint?: string) =>
    save(next)
      .then(() => showToast({ title: t.settings.saved, type: "success", lifespan: 2500 }))
      .catch(() =>
        showToast({
          title: t.settings.saveFailed,
          message: failHint,
          type: "critical",
          lifespan: 5000,
        }),
      );

  const changeMode = (value: string) => {
    const dataMode: DataMode = value === "real" ? "real" : "placeholders";
    void persist({ ...settings, dataMode }, t.settings.modeSaveFailedHint);
  };

  const changeLanguage = (value: string) => {
    const language: Lang = value === "es" ? "es" : "en";
    void persist({ ...settings, language });
  };

  const saveBridgeUrl = () => {
    if (!setBridgeUrl(bridgeUrl)) {
      showToast({ title: t.settings.bridgeInvalid, type: "critical", lifespan: 4000 });
      return;
    }
    setBridgeUrlDraft(getBridgeUrl());
    showToast({ title: t.settings.bridgeSaved, type: "success", lifespan: 2500 });
  };

  return (
    <Flex flexDirection="column" gap={24} padding={32} style={{ maxWidth: 820 }}>
      <Heading level={1}>{t.settings.title}</Heading>

      <Section>
        <Heading level={2}>{t.settings.languageTitle}</Heading>
        {/* Los nombres de idioma van siempre en su propio idioma: se reconocen igual desde cualquiera. */}
        <RadioGroup
          name="language"
          value={settings.language}
          onChange={changeLanguage}
          disabled={!loaded}
        >
          <Radio value="en">English</Radio>
          <Radio value="es">Español</Radio>
        </RadioGroup>
        <Hint>{t.settings.languageHint}</Hint>
      </Section>

      <Section>
        <Heading level={2}>{t.settings.aiTitle}</Heading>
        <Paragraph>
          <Strong>{t.settings.aiIntroStrong}</Strong>
          {t.settings.aiIntroRest}
        </Paragraph>

        <FormField>
          <Label>{t.settings.modeLabel}</Label>
          <RadioGroup
            name="data-mode"
            value={settings.dataMode}
            onChange={changeMode}
            disabled={!loaded}
          >
            <Radio value="placeholders">
              <Flex flexDirection="column" gap={2}>
                <Text>{t.settings.modePlaceholders}</Text>
                <Hint>{t.settings.modePlaceholdersHint}</Hint>
              </Flex>
            </Radio>
            <Radio value="real">
              <Flex flexDirection="column" gap={2}>
                <Text>{t.settings.modeReal}</Text>
                <Hint>{t.settings.modeRealHint}</Hint>
              </Flex>
            </Radio>
          </RadioGroup>
        </FormField>

        <div
          style={{
            padding: 12,
            background: Colors.Background.Container.Primary.Default,
            borderRadius: Borders.Radius.Container.Default,
          }}
        >
          <Text textStyle="base-emphasized">{t.settings.neverLeaves}</Text>
          <List>
            {t.settings.neverLeavesItems.map((item) => (
              <Text key={item}>{item}</Text>
            ))}
          </List>
        </div>
        <Hint>{t.settings.savedForUser}</Hint>
      </Section>

      <Section>
        <Heading level={2}>{t.settings.bridgeTitle}</Heading>
        <Paragraph>
          {t.settings.bridgeIntro}{" "}
          <ExternalLink href={BRIDGE_README}>{t.settings.bridgeHowTo}</ExternalLink>
        </Paragraph>
        <FormField>
          <Label>{t.settings.bridgeUrl}</Label>
          <Flex gap={8}>
            <TextInput
              value={bridgeUrl}
              onChange={setBridgeUrlDraft}
              placeholder={DEFAULT_BRIDGE_URL}
              style={{ flex: 1 }}
            />
            <Button variant="emphasized" onClick={saveBridgeUrl}>
              {t.settings.save}
            </Button>
          </Flex>
        </FormField>
        <Hint>{t.settings.bridgeHint(DEFAULT_BRIDGE_URL)}</Hint>
      </Section>
    </Flex>
  );
};

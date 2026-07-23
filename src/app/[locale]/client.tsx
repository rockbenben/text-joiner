"use client";

import React from "react";
import { MergeCellsOutlined } from "@ant-design/icons";
import TextJoiner from "./TextJoiner";
import { useTranslations, useLocale } from "next-intl";
import { getDocUrl } from "@/app/utils";
import ToolPage from "@/app/components/styled/ToolPage";

const ClientPage = () => {
  const t = useTranslations("TextJoiner");
  const locale = useLocale();
  const userGuideUrl = getDocUrl("guide/text/text-joiner.html", locale);

  return (
    <ToolPage icon={<MergeCellsOutlined />} toolKey="textJoiner" description={t("clientDescription")} guideUrl={userGuideUrl}>
      <TextJoiner />
    </ToolPage>
  );
};

export default ClientPage;

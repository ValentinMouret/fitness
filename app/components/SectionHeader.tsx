import { Flex, Heading } from "@radix-ui/themes";
import type React from "react";

export interface SectionHeaderProps {
  readonly title: React.ReactNode;
  readonly right?: React.ReactNode;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  right,
}) => {
  return (
    <Flex justify="between" align="center" mb="4">
      <Heading as="h2" size="5" className="section-header__title">
        {title}
      </Heading>
      {right}
    </Flex>
  );
};

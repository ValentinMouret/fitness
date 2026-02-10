import { Box, Flex, Text } from "@radix-ui/themes";
import type { MuscleRecoveryViewModel } from "../../view-models/muscle-recovery.view-model";
import { groupByCategory } from "../../view-models/muscle-recovery.view-model";
import { BodyMapSvg } from "./BodyMapSvg";
import { MuscleRecoveryLegend } from "./MuscleRecoveryLegend";
import "./MuscleRecoveryMap.css";

interface MuscleRecoveryMapProps {
  readonly viewModels: ReadonlyArray<MuscleRecoveryViewModel>;
}

export function MuscleRecoveryMap({ viewModels }: MuscleRecoveryMapProps) {
  const grouped = groupByCategory(viewModels);

  return (
    <div className="muscle-recovery">
      <BodyMapSvg viewModels={viewModels} />
      <MuscleRecoveryLegend />

      <div className="recovery-categories">
        {grouped.map((group) => (
          <Box key={group.category} className="recovery-category">
            <Text size="3" weight="bold" className="recovery-category-title">
              {group.label}
            </Text>
            <div className="recovery-muscle-list">
              {group.muscles.map((muscle) => (
                <Flex
                  key={muscle.muscleGroup}
                  align="center"
                  gap="3"
                  className="recovery-muscle-row"
                >
                  <Text size="2" className="recovery-muscle-name">
                    {muscle.label}
                  </Text>
                  <div className="recovery-bar-track">
                    <div
                      className="recovery-bar-fill"
                      style={{
                        width: `${muscle.percentage}%`,
                        backgroundColor: muscle.color,
                      }}
                    />
                  </div>
                  <Text
                    size="2"
                    weight="medium"
                    className="recovery-muscle-pct"
                  >
                    {muscle.percentageDisplay}
                  </Text>
                  {muscle.timeUntilFreshDisplay && (
                    <Text size="1" className="recovery-muscle-eta">
                      {muscle.timeUntilFreshDisplay}
                    </Text>
                  )}
                </Flex>
              ))}
            </div>
          </Box>
        ))}
      </div>
    </div>
  );
}

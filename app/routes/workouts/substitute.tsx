import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import type { Route } from "./+types/substitute";
import { AdaptiveWorkoutService } from "~/modules/fitness/application/adaptive-workout-service.server";
import { AdaptiveWorkoutRepository } from "~/modules/fitness/infra/adaptive-workout-repository.server";

export async function loader({ params }: LoaderFunctionArgs) {
  const { id: workoutId, exerciseId } = params;

  if (!workoutId || !exerciseId) {
    throw new Response("Workout ID and Exercise ID are required", {
      status: 400,
    });
  }

  // Get available equipment for substitution
  const availableEquipmentResult =
    await AdaptiveWorkoutRepository.getAvailableEquipment();
  if (availableEquipmentResult.isErr()) {
    throw new Error("Failed to load available equipment");
  }

  // Get potential substitutes
  const substitutesResult =
    await AdaptiveWorkoutRepository.findSubstitutes(exerciseId);
  if (substitutesResult.isErr()) {
    throw new Error("Failed to load exercise substitutes");
  }

  return {
    workoutId,
    exerciseId,
    availableEquipment: availableEquipmentResult.value,
    potentialSubstitutes: substitutesResult.value,
  };
}

export async function action({ params, request }: ActionFunctionArgs) {
  const { id: workoutId, exerciseId } = params;
  const formData = await request.formData();
  const selectedEquipment = formData.getAll("equipment") as string[];

  if (!workoutId || !exerciseId) {
    throw new Response("Workout ID and Exercise ID are required", {
      status: 400,
    });
  }

  // Get available equipment
  const availableEquipmentResult =
    await AdaptiveWorkoutRepository.getAvailableEquipment();
  if (availableEquipmentResult.isErr()) {
    throw new Error("Failed to load equipment data");
  }

  // Filter to only selected equipment
  const selectedEquipmentInstances = availableEquipmentResult.value.filter(
    (equipment) => selectedEquipment.includes(equipment.id),
  );

  // Find substitute exercise
  const substituteResult = await AdaptiveWorkoutService.replaceExercise(
    workoutId,
    exerciseId,
    selectedEquipmentInstances,
  );

  if (substituteResult.isErr()) {
    throw new Error(
      substituteResult.error === "no_suitable_substitutes"
        ? "No suitable substitute exercises found"
        : substituteResult.error === "equipment_unavailable"
          ? "No substitutes available with selected equipment"
          : "Failed to find substitute exercise",
    );
  }

  // Redirect back to workout with success message
  // In a real implementation, you would update the workout in the database
  return redirect(
    `/workouts/${workoutId}?substituted=${exerciseId}&new=${substituteResult.value.id}`,
  );
}

export default function SubstituteExercise({
  loaderData,
}: Route.ComponentProps) {
  const { workoutId, availableEquipment, potentialSubstitutes } = loaderData;

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Find Exercise Substitute</h1>
        <p className="text-gray-600 mt-2">
          Select available equipment to find suitable exercise alternatives
        </p>
      </div>

      <form method="post" className="space-y-6">
        {/* Available Equipment */}
        <div>
          <div className="block text-sm font-medium text-gray-700 mb-3">
            Available Equipment
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto border rounded-md p-4">
            {availableEquipment.map((equipment) => (
              <div key={equipment.id} className="flex items-center">
                <input
                  type="checkbox"
                  id={equipment.id}
                  name="equipment"
                  value={equipment.id}
                  defaultChecked={equipment.isAvailable}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label
                  htmlFor={equipment.id}
                  className="ml-2 text-sm text-gray-900"
                >
                  {equipment.name} ({equipment.exerciseType})
                  {!equipment.isAvailable && (
                    <span className="text-red-500 ml-1">(Unavailable)</span>
                  )}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Potential Substitutes Preview */}
        {potentialSubstitutes.length > 0 && (
          <div className="bg-blue-50 p-4 rounded-md">
            <h3 className="text-sm font-medium text-blue-800 mb-3">
              Potential Substitute Exercises
            </h3>
            <div className="space-y-2">
              {potentialSubstitutes.slice(0, 5).map((substitute) => (
                <div
                  key={substitute.exercise.id}
                  className="flex justify-between items-center text-sm"
                >
                  <span className="text-blue-700">
                    {substitute.exercise.name}
                  </span>
                  <div className="text-xs text-blue-600">
                    <span className="capitalize">
                      {substitute.exercise.type}
                    </span>
                    <span className="ml-2 capitalize">
                      {substitute.exercise.movementPattern}
                    </span>
                  </div>
                </div>
              ))}
              {potentialSubstitutes.length > 5 && (
                <div className="text-xs text-blue-600 italic">
                  +{potentialSubstitutes.length - 5} more options available
                </div>
              )}
            </div>
          </div>
        )}

        {potentialSubstitutes.length === 0 && (
          <div className="bg-yellow-50 p-4 rounded-md">
            <p className="text-sm text-yellow-800">
              No pre-defined substitute exercises found. The system will find
              the best available alternative based on your equipment selection.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-4">
          <button
            type="submit"
            className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Find Substitute
          </button>
          <a
            href={`/workouts/${workoutId}`}
            className="flex-1 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 text-center"
          >
            Cancel
          </a>
        </div>
      </form>
    </div>
  );
}

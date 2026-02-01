import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import type { Route } from "./+types/substitute";
import {
  getSubstituteExerciseData,
  substituteExercise,
} from "~/modules/fitness/application/substitute-exercise.service.server";
import { zfd } from "zod-form-data";
import { formRepeatableText } from "~/utils/form-data";

export async function loader({ params }: LoaderFunctionArgs) {
  const { id: workoutId, exerciseId } = params;

  if (!workoutId || !exerciseId) {
    throw new Response("Workout ID and Exercise ID are required", {
      status: 400,
    });
  }

  return getSubstituteExerciseData({ workoutId, exerciseId });
}

export async function action({ params, request }: ActionFunctionArgs) {
  const { id: workoutId, exerciseId } = params;
  const formData = await request.formData();
  const schema = zfd.formData({
    equipment: formRepeatableText(),
  });
  const parsed = schema.parse(formData);
  const selectedEquipment = parsed.equipment;

  if (!workoutId || !exerciseId) {
    throw new Response("Workout ID and Exercise ID are required", {
      status: 400,
    });
  }

  return substituteExercise({
    workoutId,
    exerciseId,
    selectedEquipmentIds: selectedEquipment,
  });
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

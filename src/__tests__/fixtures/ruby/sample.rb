# A simple Calculator class
class Calculator
  # Adds two numbers
  def add(a, b)
    a + b
  end

  # Subtracts b from a
  def subtract(a, b)
    a - b
  end

  def self.create
    new
  end
end

# Math utilities module
module MathUtils
  PI = 3.14159

  def circle_area(r)
    PI * r * r
  end
end

require "json"
require_relative "helpers"

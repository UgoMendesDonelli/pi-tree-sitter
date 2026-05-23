"""Module docstring."""
import os
from collections import defaultdict

# A simple Calculator
class Calculator:
    """A basic calculator class."""

    def add(self, a, b):
        """Add two numbers."""
        return a + b

    def subtract(self, a, b):
        return a - b


def multiply(x, y):
    """Multiply two numbers."""
    return x * y


@staticmethod
def helper():
    return 42

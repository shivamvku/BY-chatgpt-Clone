#!/usr/bin/env python3
"""
Generate All Azure Architecture Diagrams

Professional batch script to generate all YounderChat Azure architecture diagrams
using the diagram_generator.py tool. Creates high-quality PNG images suitable
for technical documentation and presentations.

Usage:
    python tools/generate_all_diagrams.py

Requirements:
    pip install -r tools/requirements-diagrams.txt
"""

import sys
import os
from pathlib import Path
import argparse
from typing import List

# Add tools directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

try:
    from diagram_generator import AzureDiagramGenerator
except ImportError as e:
    print(f"❌ Error importing diagram generator: {e}")
    print("💡 Make sure to install dependencies: pip install -r tools/requirements-diagrams.txt")
    sys.exit(1)


def main():
    """Main entry point for diagram generation."""
    parser = argparse.ArgumentParser(
        description="Generate professional Azure architecture diagrams for YounderChat"
    )
    parser.add_argument(
        "--output-dir",
        default="docs/diagrams/generated",
        help="Output directory for generated diagrams (default: docs/diagrams/generated)"
    )
    parser.add_argument(
        "--diagram",
        choices=[
            "system-overview",
            "azure-infrastructure", 
            "network-topology",
            "security-architecture",
            "cicd-pipeline",
            "data-model",
            "user-workflow",
            "all"
        ],
        default="all",
        help="Specific diagram to generate (default: all)"
    )
    parser.add_argument(
        "--resolution",
        choices=["standard", "hd", "ultra-hd"],
        default="ultra-hd",
        help="Resolution quality: standard (150 DPI), hd (200 DPI), ultra-hd (300 DPI)"
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Enable verbose output"
    )
    
    args = parser.parse_args()
    
    # Create output directory
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    if args.verbose:
        print(f"📁 Output directory: {output_dir.absolute()}")
        print(f"📊 Format: {args.format}")
        print(f"🎯 Target diagram: {args.diagram}")
    
    # Initialize generator
    generator = AzureDiagramGenerator(str(output_dir))
    
    # Generate specific diagram or all diagrams
    generated_files = []
    
    try:
        if args.diagram == "all":
            generated_files = generator.generate_all_diagrams()
        else:
            # Generate specific diagram
            diagram_methods = {
                "system-overview": generator.generate_system_overview,
                "azure-infrastructure": generator.generate_azure_infrastructure,
                "network-topology": generator.generate_network_topology,
                "security-architecture": generator.generate_security_architecture,
                "cicd-pipeline": generator.generate_cicd_pipeline,
                "data-model": generator.generate_data_model,
                "user-workflow": generator.generate_user_workflow,
            }
            
            if args.diagram in diagram_methods:
                print(f"🎨 Generating {args.diagram}...")
                filename = diagram_methods[args.diagram]()
                generated_files = [f"{filename}.png"]
                print(f"✅ Generated {filename}.png")
            else:
                print(f"❌ Unknown diagram: {args.diagram}")
                sys.exit(1)
        
        # Summary
        print(f"\n🎉 Successfully generated {len(generated_files)} diagram(s)!")
        print(f"📁 Location: {output_dir.absolute()}")
        
        if args.verbose:
            print("\n📊 Generated files:")
            for file in generated_files:
                file_path = output_dir / file
                if file_path.exists():
                    size_kb = file_path.stat().st_size / 1024
                    print(f"  ✅ {file} ({size_kb:.1f} KB)")
                else:
                    print(f"  ❌ {file} (not found)")
        
        print("\n📋 Next steps:")
        print("1. Review generated diagrams in the output directory")
        print("2. Update documentation files to reference the new diagrams")
        print("3. Commit the generated images to version control")
        
    except Exception as e:
        print(f"❌ Error generating diagrams: {e}")
        if args.verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()